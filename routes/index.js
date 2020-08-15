var express = require("express");
var router  = express.Router();
var passport = require("passport");
var User = require("../models/user");
var Optics = require("../models/optics");
var Notification = require("../models/notification");
var middleware = require("../middleware");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");
// for image upload
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

// Root route
router.get("/", function(req, res){
	res.render("landing");
});

// ==============================
// AUTH ROUTES
// ==============================
router.get("/register", function(req, res){
	res.render("register", {page: "register"});
});

// handle sign up logic
router.post("/register", upload.single('avatar'), function(req, res){
	cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
		if(err) {
			req.flash('error', err.message);
			return res.redirect('back');
		}
		// add cloudinary url for the image to the optics object under avatar property
        req.body.user.avatar = result.secure_url;
        // add image's public_id to optics object
        req.body.user.imageId = result.public_id;
		
// 		check admin
		if(req.body.adminCode === "secretcode123"){
			newUser.isAdmin = true;
		}
		User.register(req.body.user, req.body.password, function(err, user){
			if(err){
				console.log(err);
				return res.render("register", {error: err.message});
			}
			passport.authenticate("local")(req, res, function(){
				req.flash("success", "Successfully Signed Up! Nice to meet you " + user.username);
				res.redirect("/optics");
			});
		});
	});
});

// show login form
router.get("/login", function(req, res){
	res.render("login", {page: "login"});
});

// handling login logic
router.post("/login", passport.authenticate("local",{
		successRedirect: "/optics",
		failureRedirect: "/login"
	}), function(req, res){
});

// logout route
router.get("/logout", function(req,res){
	req.logout();
	req.flash("success", "Logged You Out");
	res.redirect("/optics");
});

// forgot password
router.get("/forgot", function(req, res) {
  res.render("forgot");
});

router.post("/forgot", function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString("hex");
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash("error", "No account with that email address exists.");
          return res.redirect("/forgot");
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: "Gmail", 
        auth: {
          user: "learntocodeinfo@gmail.com",
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: "learntocodeinfo@gmail.com",
        subject: "Node.js Password Reset",
        text: "You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n" +
          "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
          "http://" + req.headers.host + "/reset/" + token + "\n\n" +
          "If you did not request this, please ignore this email and your password will remain unchanged.\n"
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        console.log("mail sent");
        req.flash("success", "An e-mail has been sent to " + user.email + " with further instructions.");
        done(err, "done");
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect("/forgot");
  });
});

router.get("/reset/:token", function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired.");
      return res.redirect("/forgot");
    }
    res.render("reset", {token: req.params.token});
  });
});

router.post("/reset/:token", function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash("error", "Password reset token is invalid or has expired.");
          return res.redirect("back");
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          })
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect("back");
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: "Gmail", 
        auth: {
          user: "learntocodeinfo@gmail.com",
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: "learntocodeinfo@mail.com",
        subject: "Your password has been changed",
        text: "Hello,\n\n" +
          "This is a confirmation that the password for your account " + user.email + " has just been changed.\n"
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash("success", "Success! Your password has been changed.");
        done(err);
      });
    }
  ], function(err) {
    res.redirect("/optics");
  });
});


// users profile
router.get("/users/:id", async function(req, res) {
	try {
		let user = await User.findById(req.params.id).populate("followers").exec();
		Optics.find().where("author.id").equals(user._id).exec(function(err, optics){
			if(err){
				req.flash("error", "Something went wrong");
				res.redirect("/optics");
			}
			res.render("users/show", { user, optics: optics });
		});	
	} catch(err) {
		req.flash("error", err.message);
		return res.redirect("back");
	}
});

// follow user
router.get('/follow/:id', middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.params.id);
    user.followers.push(req.user._id);
    user.save();
    req.flash('success', 'Successfully followed ' + user.username + '!');
    res.redirect('/users/' + req.params.id);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

// view all notifications
router.get('/notifications', middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.user._id).populate({
      path: 'notifications',
      options: { sort: { "_id": -1 } }
    }).exec();
    let allNotifications = user.notifications;
    res.render('notifications/index', { allNotifications });
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

// handle notification
router.get('/notifications/:id', middleware.isLoggedIn, async function(req, res) {
  try {
    let notification = await Notification.findById(req.params.id);
    notification.isRead = true;
    notification.save();
    res.redirect(`/optics/${notification.opticsId}`);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});



module.exports = router;