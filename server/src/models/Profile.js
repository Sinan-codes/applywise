import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 160 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 60, default: "" },
  location: { type: String, trim: true, maxlength: 160, default: "" },
  linkedin: { type: String, trim: true, maxlength: 500, default: "" },
  website: { type: String, trim: true, maxlength: 500, default: "" },
  github: { type: String, trim: true, maxlength: 500, default: "" },
  skills: { type: String, trim: true, maxlength: 4000, default: "" },
  education: { type: String, trim: true, maxlength: 4000, default: "" },
  workAuthorization: { type: String, trim: true, maxlength: 1000, default: "" },
  sponsorship: { type: String, trim: true, maxlength: 1000, default: "" },
  salaryExpectation: { type: String, trim: true, maxlength: 500, default: "" }
}, { timestamps: true, versionKey: false });

const Profile = mongoose.model("Profile", profileSchema);

export default Profile;
