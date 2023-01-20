const express = require("express");
const auth = require("../../middleware/auth");
const upload = require("../../middleware/upload")

const {
  crtlRegisterUser,
  crtlLoginUser,
  ctrlLogoutUser,
  ctrlCurrentUser,
  uploadAndPatchAvatar,
  ctrlEmailVerification,
  ctrlOneMoreVerification,
} = require("../../controllers/users");

const router = express.Router();

router.post("/register", crtlRegisterUser);

router.post("/login", crtlLoginUser);

router.post("/logout", auth, ctrlLogoutUser);

router.get("/current", auth, ctrlCurrentUser);

router.patch("/avatars", auth, upload.single("avatar"), uploadAndPatchAvatar);

router.get("/verify/:verificationToken", ctrlEmailVerification);

router.post("/verify/", ctrlOneMoreVerification)

module.exports = router;
