const app = require("./app");
// require('dotenv').config({ path: '.env.production' });

// set port, listen for requests
const PORT = process.env.PORT || 4022;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
  // Initial database
  require("./initial")();
});
