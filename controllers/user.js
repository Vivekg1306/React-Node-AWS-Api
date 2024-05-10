const Link = require("../models/link");
const User = require("../models/user");

exports.read = (req, res) => {
  // req.profile.hashed_password = undefined;
  // req.profile.salt = undefined;
  User.findOne({ _id: req.auth._id })
    .exec()
    .then((user) => {
      Link.find({ postedBy: user })
        .populate("categories", "name slug")
        .populate("postedBy", "name")
        .sort({ createdAt: -1 })
        .exec()
        .then((links) => {
          user.hashed_password = undefined;
          user.salt = undefined;
          res.json({ user, links });
        })
        .catch((err) => {
          return res.status(400).json({
            error: "Could not find links",
          });
        });
    })
    .catch((err) => {
      return res.status(400).json({
        error: "User not found",
      });
    });
};

exports.update = (req, res) => {
  const { name, password, categories } = req.body;
  switch (true) {
    case password && password.length < 6:
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
      break;
  }

  User.findOneAndUpdate(
    { _id: req.auth._id },
    { name, password, categories },
    { new: true }
  )
    .exec()
    .then((updated) => {
      updated.hashed_password = undefined;
      updated.salt = undefined;
      res.json(updated);
    })
    .catch((err) => {
      return res.status(400).json({
        error: "Could not find user to update",
      });
    });
};
