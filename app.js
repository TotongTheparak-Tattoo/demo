const express = require("express");
const cors = require("cors");

const app = express();
module.exports = app;

// var corsOptions = {
//   origin: "http://localhost:3001",
// };

// Generate openapi
const expressOasGenerator = require("express-oas-generator");
expressOasGenerator.init(app, {});

app.use(cors());

// parse requests of content-type - application/json
// enable requests limit of 50 mb
app.use(express.json({limit: '50mb'}));

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));


// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to wms service." });
});

//use the routes
require("./app/routes/authentication.routes")(app);
require("./app/routes/division.routes")(app);
require("./app/routes/upload.routes")(app);
require("./app/routes/inbound.routes")(app);
require("./app/routes/picking.routes")(app);
require("./app/routes/masterUpload.routes")(app);
require("./app/routes/productBalance.routes")(app);
require("./app/routes/vendorMaster.routes")(app);
require("./app/routes/location.routes")(app);
require("./app/routes/voidprocess.routes")(app);
require("./app/routes/voidscan.routes")(app);
require("./app/routes/productLog.routes")(app);
require("./app/routes/mrRequestLog.routes")(app);
require("./app/routes/itemList.routes")(app);
require("./app/routes/monthlyDataLog.routes")(app);
require("./app/routes/transactionMovementLog.routes")(app);
require("./app/routes/monthlyData.routes")(app);
require("./app/routes/transactionMovement.routes")(app);