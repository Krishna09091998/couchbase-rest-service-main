const couchbase = require('couchbase');
require('dotenv').config(); // Load environment variables

const clusterConnStr = process.env.CB_HOST || "couchbases://cb.wf6ax-4hcobxv2w.cloud.couchbase.com";
// couchbases://cb.wf6ax-4hcobxv2w.cloud.couchbase.com
const username = process.env.CB_USERNAME || "mt-dev";
const password = process.env.CB_PASSWORD || "D@v!t@2025";
const bucketName = process.env.CB_BUCKET || "Path_Master_Load";
const scopeName = process.env.CB_SCOPE || "_default";
// const collectionName = "Hospital";

async function connectToCouchbase() {
  try {
      console.log(` Connecting to Couchbase at ${clusterConnStr}`);
      const cluster = await couchbase.connect(clusterConnStr, {
          username,
          password,
          configProfile: "wanDevelopment",
      });

      console.log("Connected to Couchbase.");

      const bucket = cluster.bucket(bucketName);
      console.log(`Using bucket: ${bucketName}`);

      const scope = bucket.scope(scopeName);
      console.log(`Using scope: ${scopeName}`);

     // const collection = scope.collection(collectionName);
     // console.log(`Using collection: ${collection}`);
     // console.log(`Using Collection: ${JSON.stringify(collection._name,null,2)}`);



      return { cluster, bucket, scope };
  } catch (err) {
      console.error(" Couchbase Connection Error:", err);
      throw err;
  }
}

module.exports = connectToCouchbase();