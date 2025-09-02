const express = require('express');
const dotenv = require('dotenv');
const couchbase = require('./config/couchbase');
const dataRoutes = require('./routes/dataRoutes');

dotenv.config();
const app = express();
app.use(express.json());
app.use('/api', dataRoutes);

const PORT = process.env.PORT || 3000;
const HOST = 'http://couchbase-rest-service-main';  // Change this if deployed

app.listen(PORT, () => {
  console.log(`Server running at ${HOST}:${PORT}`);
});