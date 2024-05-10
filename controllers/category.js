const Category = require("../models/category");
const Link = require("../models/link");
const slugify = require("slugify");
const formidable = require("formidable");
const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const fs = require("fs");

// s3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// exports.create = (req, res) => {
//   let form = new formidable.IncomingForm();

//   form.parse(req, (err, fields, files) => {
//     if (err) {
//       return res.status(400).json({
//         error: "Image could not be uploaded",
//       });
//     }
//     const { name, content } = fields;
//     const { image } = files;
//     console.log(name, content, image);
//     const slug = slugify(name[0]);
//     let category = new Category({ name: name[0], content: content[0], slug });
//     console.log("category", category);

//     if (image.size > 2000000) {
//       return res.status(400).json({
//         error: "Image should be less than 2mb",
//       });
//     }
//     const params = {
//       Bucket: "aws-s3-react-node",
//       Key: `category/${uuidv4()}`,
//       Body: fs.readFileSync(image[0].filepath),
//       ContentType: `image/jpg`,
//     };

//     s3.upload(params, (err, data) => {
//       if (err) res.status(400).json({ error: "Upload to s3 failed" });
//       category.image.url = data.Location;
//       category.image.key = data.key;

//       category
//         .save()
//         .then((success) => {
//           return res.json(success);
//         })
//         .catch((err) => {
//           res.status(400).json({ error: "Duplicate category" });
//         });
//     });
//   });
// };
// exports.create = (req, res) => {
//   const { name, content } = req.body;
//   const slug = slugify(name);
//   const image = {
//     url: `https://via.placeholder.com/200x150.png?text=${process.env.CLIENT_URL}`,
//     key: "123",
//   };

//   const category = new Category({ name, slug, image });
//   category.postedBy = req.auth._id;

//   category
//     .save()
//     .then((data) => {
//       res.json(data);
//     })
//     .catch((err) => {
//       return res.status(400).json({
//         error: "Category create failed",
//       });
//     });
// };

exports.create = (req, res) => {
  const { name, image, content } = req.body;
  // image data
  const base64Data = new Buffer.from(
    image.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );

  const type = image.split(";")[0].split("/")[1];

  const slug = slugify(name);
  let category = new Category({ name, content, slug });

  const params = {
    Bucket: "aws-s3-react-node",
    Key: `category/${uuidv4()}.${type}`,
    Body: base64Data,
    ContentEncoding: "base64",
    ContentType: `image/${type}`,
  };

  s3.upload(params, (err, data) => {
    if (err) res.status(400).json({ error: "Upload to s3 failed" });
    category.image.url = data.Location;
    category.image.key = data.key;
    // posted by
    category.postedBy = req.auth._id;

    category
      .save()
      .then((success) => {
        return res.json(success);
      })
      .catch((err) => {
        res.status(400).json({ error: "Duplicate category" });
      });
  });
};

exports.list = (req, res) => {
  Category.find({})
    .exec()
    .then((data) => res.json(data))
    .catch((err) => {
      return res.status(400).json({
        error: "Categories could not load",
      });
    });
};

exports.read = (req, res) => {
  const { slug } = req.params;
  let limit = req.body.limit ? parseInt(req.body.limit) : 10;
  let skip = req.body.skip ? parseInt(req.body.skip) : 0;

  Category.findOne({ slug })
    .populate("postedBy", "_id name username")
    .exec()
    .then((category) => {
      Link.find({ categories: category })
        .populate("postedBy", "_id name username")
        .populate("categories", "name")
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .exec()
        .then((links) => res.json({ category, links }))
        .catch((err) => {
          return res.status(400).json({
            error: "Could not load links of a category",
          });
        });
    })
    .catch((err) => {
      return res.status(400).json({
        error: "Could not load category",
      });
    });
};

exports.update = (req, res) => {
  const { slug } = req.params;
  const { name, image, content } = req.body;

  // image data
  const base64Data = new Buffer.from(
    image.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );
  const type = image.split(";")[0].split("/")[1];

  Category.findOneAndUpdate({ slug }, { name, content }, { new: true })
    .exec()
    .then((updated) => {
      console.log("UPDATED", updated);
      if (image) {
        // remove the existing image from s3 before uploading new/updated one
        const deleteParams = {
          Bucket: "aws-s3-react-node",
          Key: `${updated.image.key}`,
        };

        s3.deleteObject(deleteParams, function (err, data) {
          if (err) console.log("S3 DELETE ERROR DURING UPDATE", err);
          else console.log("S3 DELETED DURING UPDATE", data); // deleted
        });

        // handle upload image
        const params = {
          Bucket: "aws-s3-react-node",
          Key: `category/${uuidv4()}.${type}`,
          Body: base64Data,
          ContentEncoding: "base64",
          ContentType: `image/${type}`,
        };

        s3.upload(params, (err, data) => {
          if (err) res.status(400).json({ error: "Upload to s3 failed" });
          updated.image.url = data.Location;
          updated.image.key = data.key;

          updated
            .save()
            .then((success) => {
              res.json(success);
            })
            .catch((err) => {
              res.status(400).json({ error: "Duplicate category" });
            });
        });
      } else {
        res.json(updated);
      }
    })
    .catch((err) => {
      return res.status(400).json({
        error: "Could not find category to update",
      });
    });
};

exports.remove = (req, res) => {
  const { slug } = req.params;

  Category.findOneAndDelete({ slug })
    .exec()
    .then((data) => {
      const deleteParams = {
        Bucket: "aws-s3-react-node",
        Key: `${data.image.key}`,
      };

      s3.deleteObject(deleteParams, function (err, data) {
        if (err) console.log("S3 DELETE ERROR DURING", err);
        else console.log("S3 DELETED DURING", data); // deleted
      });

      res.json({ message: "Category deleted successfully" });
    })
    .catch((err) => {
      return res.status(400).json({
        error: "Could not delete category",
      });
    });
};
