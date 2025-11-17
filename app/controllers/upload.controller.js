const UploadService = require("../services/upload.service");
class UploadController {
  //upload data to product
  async uploadToProduct(req, res) {
    try {
     const result = await UploadService.uploadToProduct(req.body);
      return res.status(result.statusCode || 200).json({
        result: result
      });
    } catch (error) {
      return res.status(500).json({ 
        result: {
          success: false,
          message: error.message || error.toString()
        }
      });
    }
  }
}
module.exports = new UploadController();