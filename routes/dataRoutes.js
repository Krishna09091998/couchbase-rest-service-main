
const express = require("express");
const router = express.Router();
const db = require("../config/couchbase"); // Import Couchbase connection
const fetch = require('node-fetch');


// Sync Gateway admin details
const SGW_ADMIN_URL = "https://9ta5vaemznwy6qkj-admin.apps.cloud.couchbase.com/path-grande-dev3";
const ADMIN_USER = process.env.SGW_ADMIN_USER;
const ADMIN_PASS = process.env.SGW_ADMIN_PASS;

/**
 * Testing Event Trigger
 * Inserts a document into the source bucket to trigger Eventing
 */
router.post("/triggerEvent", async (req, res) => {
    console.log("Processing triggerEvent request...");

    try {

        const { bucket, scope } = await db;
        if (!bucket) throw new Error("Couchbase bucket not found.");

        const collection = scope.collection("Hospital");  // Source collection for Eventing

        // Use id and name to trigger the Eventing function
        const { id, name } = req.body;
        if (!id || !name) return res.status(400).json({ status: 400, error: "Missing id or name" });

        const docId = `hospital::${id}`;
        const docData = {
            id,
            name
        };

        await collection.upsert(docId, docData);

        console.log(`Document inserted: ${docId}`, JSON.stringify(docData));

        return res.status(200).json({ status: 200, message: "Event-triggering document inserted", data: docData });

    } catch (error) {
        console.error("Error in triggerEvent router:", error.message);
        return res.status(500).json({ status: 500, error: error.message });
    }
});


//On insert/upsert of hospital doc role will be created based on the eventing function trigger:
// + create SGW role
router.post("/hospital", async (req, res) => {
  try {
    const { id, name } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: "Missing id or name" });
    }

    console.log(`Received hospital doc from Eventing: ${id}, ${name}`);

    const roleName = "role_tx_Treatment_" + id;
    const newPayload = {
      name: roleName,
      collection_access: {
        treatment: {
          Encounter: {
            admin_channels: [ "tx_Encounter_" + id ]
          }
        }
      }
    };

    // Step 1: Check if role already exists
    const checkRoleRes = await fetch(`${SGW_ADMIN_URL}/_role/${encodeURIComponent(roleName)}`, {
      method: "GET",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString("base64")
      }
    });

    if (checkRoleRes.ok) {
      // Role exists → compare channel mapping
      const existingRole = await checkRoleRes.json();
      const existingChannels = existingRole?.collection_access?.treatment?.Encounter?.admin_channels || [];

      const newChannels = newPayload.collection_access.treatment.Encounter.admin_channels;

      // Compare arrays (basic stringified comparison for simplicity)
      if (JSON.stringify(existingChannels) === JSON.stringify(newChannels)) {
        console.log(`Role ${roleName} already exists with same channels. Skipping update.`);
        return res.json({ success: true, action: "skipped", role: roleName });
      }

      console.log(`Role ${roleName} exists but channel mapping changed. Updating...`);
    } else {
      console.log(`Role ${roleName} does not exist. Creating...`);
    }

    // Step 2: Create or Update role
    const putRoleRes = await fetch(`${SGW_ADMIN_URL}/_role/${encodeURIComponent(roleName)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString("base64")
      },
      body: JSON.stringify(newPayload)
    });

    const body = await putRoleRes.text();
    console.log("SGW role creation/update response:", putRoleRes.status, body);

    if (putRoleRes.ok) {
      return res.json({ success: true, action: "created-or-updated", role: roleName });
    } else {
      return res.status(putRoleRes.status).json({
        error: "Role creation/update failed",
        sgwStatus: putRoleRes.status,
        sgwBody: body
      });
    }

  } catch (err) {
    console.error("Error handling /hospital request:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Delete SGW Role when hospital doc is deleted
router.post("/hospital/delete", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    const roleName = "role_tx_Treatment_" + id;

    const response = await fetch(`${SGW_ADMIN_URL}/_role/${encodeURIComponent(roleName)}`, {
      method: "DELETE",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString("base64")
      }
    });

    const body = await response.text();
    console.log("SGW role deletion response:", response.status, body);

    if (response.ok) {
      res.json({ success: true, deletedRole: roleName });
    } else {
      res.status(response.status).json({
        error: "Role deletion failed",
        sgwStatus: response.status,
        sgwBody: body
      });
    }
  } catch (err) {
    console.error("Error deleting role:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});



module.exports = router;
