import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const url = cloudinary.url("test_files/test_raw_1771781840392.pdf", {
  resource_type: "raw",
  type: "upload",
  sign_url: true
});

console.log(url);
