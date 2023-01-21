const express = require("express");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const gravatar = require("gravatar");
const Jimp = require("jimp");
const fs = require("fs/promises");
const { v4: uuidv4 } = require("uuid");
const sgMail = require("@sendgrid/mail");

const {
  findOne,
  findOneAndUpdate,
  create,
} = require("../models/functionsUsers");
const User = require("../models/users");

const { SECRET_KEY, PORT, SENDGRID_API_KEY } = process.env;

const schema = Joi.object({
  email: Joi.string()
    .email({
      minDomainSegments: 2,
      tlds: { allow: ["com", "net"] },
    })
    .required(),
  password: Joi.string().required(),
});

const schemaVerify = Joi.object({
    email: Joi.string()
      .email({
        minDomainSegments: 2,
        tlds: { allow: ["com", "net"] },
      })
      .required(),
  });

const ctrlEmailVerification = async (req, res) => {
  const { verificationToken } = req.params;
  const result = User.findOneAndUpdate(
    { verificationToken },
    { verificationToken: null, verify: true }
  );
  if (result === null) {
    return res.status(404).send({ message: "User not found" });
  }
  res.send({ message: "Verification successful" });
};

const ctrlOneMoreVerification = async (req, res) => {
    const { error } = schemaVerify.validate(req.body);
  if (error) {
    return res
      .status(400)
      .send({ message: "Missing required field email" });
  }
  const { email } = req.body;
 
  const isEmail = await findOne(email);
 
 if(!isEmail.verify) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    const msg = {
      to: email, // Change to your recipient
      from: "oradio@ukr.net", // Change to your verified sender
      subject: "Verify your registration",
      text: "and easy to do anywhere, even with Node.js",
      html: `<a href="http://localhost:${PORT}users/verify/newUser.verificationToken">Click here to verify your account</a>`,
    };
    sgMail
      .send(msg)
      .then(() => {
        console.log("Email sent");
      })
      .catch((error) => {
        console.error(error);
      });

      return res.send({
        message: "Verification email sent"
        }
      );
 }
res.status(400).send({"message":"Verification has already been passed"})
   
}

const uploadAndPatchAvatar = async (req, res) => {
  const { _id } = req.user;
  const { path, filename } = req.file;
  const avatarUrlPath = `/avatars/${req.user._id}_${filename}`;
  Jimp.read(req.file.path)
    .then((result) => {
      return result
        .resize(250, 250) // resize
        .write(`./public/${avatarUrlPath}`); // save
    })
    .catch((err) => {
      console.error(err);
    });
  await fs.unlink(path);
  await User.findByIdAndUpdate(_id, { avatarURL: avatarUrlPath });
  res.send({ avatarURL: `http://localhost:${PORT}${avatarUrlPath}` });
};

const crtlRegisterUser = async (req, res) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .send({ message: "Помилка від Joi або іншої бібліотеки валідації" });
  }
  const { password, email } = req.body;
  const resultUrl = gravatar.url(email);

  const isEmail = await findOne(email);
  if (isEmail) {
    return res.status(409).send({ message: "Email in use" });
  }
  const hashPassword = await bcrypt.hash(password, 10);
  const newUser = await create({
    email,
    password: hashPassword,
    avatarURL: resultUrl,
    verificationToken: uuidv4(),
  });

  sgMail.setApiKey(SENDGRID_API_KEY);
  const msg = {
    to: email, // Change to your recipient
    from: "oradio@ukr.net", // Change to your verified sender
    subject: "Verify your registration",
    text: "and easy to do anywhere, even with Node.js",
    html: `<a href="http://localhost:${PORT}users/verify/newUser.verificationToken">Click here to verify your account</a>`,
  };
  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent");
    })
    .catch((error) => {
      console.error(error);
    });

  res.status(201).send({
    user: {
      email: email,
      subscription: newUser.subscription,
      avatarURL: resultUrl,
    },
  });
};

const crtlLoginUser = async (req, res) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .send({ message: "Помилка від Joi або іншої бібліотеки валідації" });
  }
  const { password, email } = req.body;

  const validEmail = await findOne(email);
  if (!validEmail || !validEmail.verify) {
    return res.status(400).send({ message: "Email or password is wrong" });
  }

  const validPassword = bcrypt.compare(password, validEmail.password);
  if (!validPassword) {
    return res.status(400).send({ message: "Email or password is wrong" });
  }
  const token = jwt.sign({ id: validEmail._id }, SECRET_KEY, {
    expiresIn: "7d",
  });
  await findOneAndUpdate({ email }, { token });

  res.status(200).send({
    token: token,
    user: {
      email: validEmail.email,
      subscription: validEmail.subscription,
    },
  });
};

const ctrlLogoutUser = async (req, res) => {
  findOneAndUpdate({ _id: req.user._id }, { token: "" });
  res.status(204).json();
};

const ctrlCurrentUser = async (req, res) => {
  res.status(200).send({
    email: req.user.email,
    subscription: req.user.subscription,
  });
};

module.exports = {
  crtlRegisterUser,
  crtlLoginUser,
  ctrlLogoutUser,
  ctrlCurrentUser,
  uploadAndPatchAvatar,
  ctrlEmailVerification,
  ctrlOneMoreVerification,
};
