var express = require("express");
var router  = express.Router();
var Optics = require("../models/optics");
var User = require("../models/user");
var Notification = require("../models/notification");
var middleware = require("../middleware");
// it's automatically require index.js which is inside the middleware directory
var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

var cloudinary = require('cloudinary');
cloudinary.config({ 
  cloud_name: 'dtqkfox8c', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});


// INDEX = show all opticss
router.get("/", function(req, res){
	var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
	var noMatch = null;
    if(req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        // Get all optics from DB
         Optics.find({name: regex}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allOptics) {
			 Optics.countDocuments({name: regex}).exec(function (err, count) {
				if(err){
					console.log(err);
					res.redirect("back");
			    } else {
					if(allOptics.length < 1) {
						noMatch = "No optics match that query, please try again.";
					}
					res.render("optics/index", {
						optics: allOptics,
						current: pageNumber,
						pages: Math.ceil(count / perPage),
						noMatch: noMatch,
						search: req.query.search
					});
				}
			});
        });
    } else {
		Optics.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allOptics) {
        	Optics.countDocuments().exec(function (err, count) {
				if(err){
					console.log(err);
				} else {
					res.render("optics/index", {
						optics: allOptics,
						current: pageNumber,
						noMatch: noMatch,
						pages: Math.ceil(count / perPage)
					});
				}
			});
		});
	}
});

//CREATE - add new optics to DB
router.post("/", middleware.isLoggedIn, upload.single('image'), function(req, res) {
	cloudinary.v2.uploader.upload(req.file.path, async function(err, result) {
		if(err) {
			req.flash('error', err.message);
			return res.redirect('back');
		}
		// add cloudinary url for the image to the optics object under image property
        req.body.optics.image = result.secure_url;
        // add image's public_id to optics object
        req.body.optics.imageId = result.public_id;
        // add author to optics
        req.body.optics.author = {
			id: req.user._id,
            username: req.user.username
		}
		try {
			let optics = await Optics.create(req.body.optics);
			let user = await User.findById(req.user._id).populate('followers').exec();
			let newNotification = {
				username: req.user.username,
				opticsId: optics.slug
			}
			for(const follower of user.followers) {
				let notification = await Notification.create(newNotification);
				follower.notifications.push(notification);
				follower.save();
			}

			//redirect back to optics page
			res.redirect(`/optics/${optics.slug}`);
		} catch(err) {
			req.flash('error', err.message);
			res.redirect('back');
		}
    });
});

// NEW = show form to create new optics
router.get("/new", middleware.isLoggedIn, function(req, res){
	res.render("optics/new");
});

// point to be noted: "SHOW" should come after "NEW" otherwise it will treat NEW as anyother variable
// SHOW = shows more information about one campgraound
router.get("/:slug", function(req, res){
    //find the optics with provided ID
    Optics.findOne({slug: req.params.slug}).populate("comments likes").exec(function(err, foundOptics){
		if(err || !foundOptics){
			console.log(err);
			req.flash("error", "Optics not found");
			res.redirect("back");
		} else{
// 			render show template in that optics
			res.render("optics/show", {optics: foundOptics});
		}
	});
});

// Optics Like Route
router.post("/:slug/like", middleware.isLoggedIn, function (req, res) {
    Optics.findOne({slug: req.params.slug}, function (err, foundOptics) {
        if (err) {
            console.log(err);
            return res.redirect("/optics");
        }
			// check if req.user._id exists in foundOptics.likes
			var foundUserLike = foundOptics.likes.some(function (like) {
				return like.equals(req.user._id);
			});

			if (foundUserLike) {
				// user already liked, removing like
				foundOptics.likes.pull(req.user._id);
			} else {
				// adding the new user like
				foundOptics.likes.push(req.user);
			}

			foundOptics.save(function (err) {
				if (err) {
					console.log(err);
					return res.redirect("/optics");
				}
				return res.redirect("/optics/" + foundOptics.slug);
        	});
    });
});

// EDIT OPTICS ROUTE
router.get("/:slug/edit", middleware.checkOpticsOwnership, function(req, res){
    Optics.findOne({slug: req.params.slug}, function(err, foundOptics){
        res.render("optics/edit", {optics: foundOptics});
    });
});

// UPDATE OPTICS ROUTE
router.put("/:slug", middleware.checkOpticsOwnership, upload.single("image"),function(req, res){
    // find and update the correct optics
	Optics.findOne({slug: req.params.slug}, async function(err, optics){
		if(err){
			req.flash("error", err.message);
			res.redirect("back");
		} else {
			if (req.file) {
				try {
					await cloudinary.v2.uploader.destroy(optics.imageId);
					var result = await cloudinary.v2.uploader.upload(req.file.path);
					optics.imageId = result.public_id;
					optics.image = result.secure_url;
				} catch(err) {
					req.flash("error", err.message);
				return res.redirect("back");
				}
			}
			optics.name = req.body.optics.name;
			optics.description = req.body.optics.description;
			optics.save(function (err) {
				if(err){
					req.flash("error", "Something went wrong!");
					res.redirect("/optics");
				} else {
					req.flash("success", "Successfully Updated!");
					res.redirect("/optics/" + optics.slug);
				}
			});
		}
	});
});

// DESTROY OPTICS ROUTE
router.delete("/:slug",middleware.checkOpticsOwnership, function(req, res){
   Optics.findOne({slug: req.params.slug}, async function(err, optics){
      if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}
		try {
			await cloudinary.v2.uploader.destroy(optics.imageId);
			optics.remove();
			req.flash('success', 'Optics deleted successfully!');
			res.redirect('/optics');
		} catch(err) {
			if(err) {
			  req.flash("error", err.message);
			  return res.redirect("back");
			}
   		}
    });
});

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;