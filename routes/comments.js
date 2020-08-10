var express = require("express");
var router  = express.Router({mergeParams: true});
var Optics = require("../models/optics");
var Comment = require("../models/comment");
var middleware = require("../middleware");
// it's automatically require index.js which is inside the middleware directory

// Comments new
router.get("/new", middleware.isLoggedIn, function(req, res){
	Optics.findOne({slug: req.params.slug}, function(err, optics){
		if(err){
			console.log(err);
		} else{
			res.render("comments/new", {optics: optics});
		}
	});
});

// Comments create
router.post("/", middleware.isLoggedIn, function(req, res){
// 	lookup optics using ID
	Optics.findOne({slug: req.params.slug}, function(err, optics){
		if(err){
			res.redirect("/optics");
		} else{
			Comment.create(req.body.comment, function(err, comment){
				if(err){
					req.flash("error", "Something went wrong");
					console.log(err);
				} else{
// 					add username and id to comment
					comment.author.id = req.user._id;
					comment.author.username = req.user.username;
// 					save comment
					comment.save();
					optics.comments.push(comment);
					optics.save();
					req.flash("success", "Successfully added a Comment");
					res.redirect("/optics/" + optics.slug);
				}
			});
		}
	});
});

// Edit Route
router.get("/:comment_id/edit", middleware.checkCommentOwnership, function(req, res){
	Optics.findOne({slug: req.params.slug}, function(err, foundOptics){
		if(err || !foundOptics){
			req.flash("error", "Optics not found");
			return res.redirect("back");
		}
		Comment.findById(req.params.comment_id, function(err, foundComment){
			if(err){
				res.redirect("back");
			} else{
				res.render("comments/edit", {optics_slug: req.params.slug, comment: foundComment});
			}
		});
	});	
});

// Update Route
router.put("/:comment_id", middleware.checkCommentOwnership, function(req, res){
	Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
		if(err){
			res.redirect("back");
		} else{
			res.redirect("/optics/" + req.params.slug);
		}
	});
});

// Destroy Route
router.delete("/:comment_id", middleware.checkCommentOwnership, function(req, res){
	Comment.findByIdAndRemove(req.params.comment_id, function(err){
		if(err){
			res.redirect("back");
		} else{
			req.flash("success", "Successfully removed a Comment");
			res.redirect("/optics/" + req.params.id);
		}
	});
});

module.exports = router;