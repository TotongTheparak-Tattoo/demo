// const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

// const envFile = `.env.${process.env.NODE_ENV || 'development'}`;

// Load environment variables
// dotenv.config({ path: envFile });

class JWT {
  //create jwt toketn for Sign in
  async createToken(empNo, roleName, levelName, signupStatus, divisionId, authId) {
    const token = jwt.sign(
      { empNo: empNo, roleName: roleName, levelName: levelName,signupStatus: signupStatus, divisionId: divisionId, authId },
      process.env.JWT_SECRET,
      {
        expiresIn: "3days",
      }
    );
    return token;
  }

  // Middleware to verify JWT token
  async verifyToken(req, res, next) {
    // console.log(req);
    const token = req.header("Authorization")?.split(" ")[1]; // Get token from Authorization header
  // console.log(token)
    if (!token) {
      return res.status(403).json({ result: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // Add user info to request
      next(); // Proceed to the next middleware or route handler
    } catch (err) {
      return res.status(401).json({ result: "Invalid or expired token" });
    }
  }
  // Middleware to check if user is a regular production
  async isWarehouse(req, res, next) {
    if (req.user.roleName !== "warehouse") {
      return res.status(403).json({ result: "Access denied." });
    }
    next(); // If the user is a regular user or an admin, proceed to the next route handler
  }
  async isAdmin(req,res, next){
    if (req.user.levelName !== "admin") {
      return res.status(403).json({ result: "Access denied." });
    }
    next(); // If the user is a regular user or an admin, proceed to the next route handler
  }
  async isWarehouseStaffAndProductionStaff(req,res,next){
    if (req.user.levelName !== "staff" && req.user.levelName !== "admin"){
      return res.status(403).json({ result: "Access denied." });
    }
    next(); // If the user is a staff user or an admin, proceed to the next route handler
  }
  async isWarehouseStaffAndAdmin(req, res, next) {
    const { roleName, levelName } = req.user;

    if (
      (roleName !== "warehouse") || 
      (levelName !== "staff" && levelName !== "admin") 
    ) {
      return res.status(403).json({ result: "Access denied." });
    }

    next(); 
  }
  async isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin(req, res, next) {
    const { roleName, levelName } = req.user;

    if (
      (roleName !== "warehouse")|| 
      (levelName !== "operator" && levelName !== "admin" && levelName !== "staff") 
    ) {
      return res.status(403).json({ result: "Access denied." });
    }
    next(); 
  }

  // Middleware to check if user is a regular warehouse or production
  async isWarehouseOrProduction(req, res, next) {
    if (req.user.roleName !== "warehouse" && req.user.roleName !== "production") {
      return res
        .status(403)
        .json({ result: "Access denied. Warehouse user only." });
    }
    next(); // If the user is a regular user or an admin, proceed to the next route handler
  }
}

module.exports = new JWT();
