var Optics = require("../models/optics"),
	Comment = require("../models/comment");
var middlewareObj = {};

middlewareObj.checkOpticsOwnership = function(req, res, next) {
	if(req.isAuthenticated()){
        Optics.findOne({slug: req.params.slug}, function(err, foundOptics){
			if(err || !foundOptics){
				console.log(err);
				req.flash("error", "Image not found!");
				res.redirect("back");
			} else {
				// 	does user own the Optics???
				if(foundOptics.author.id.equals(req.user._id) || req.user.isAdmin){
					next();
				} else {
					req.flash("error", "You don't have permission to do that!");
					res.redirect("back");
				}
			}
		});
	} else {
		req.flash("error", "You need to be logged in to do that!!");
		res.redirect("back");
	}
}

middlewareObj.checkCommentOwnership = function(req, res, next) {
	if(req.isAuthenticated()){
		Comment.findById(req.params.comment_id, function(err, foundComment){
			if(err || !foundComment){
				req.flash("error", "Comment not found");
				res.redirect("back");
			} else {
				// 	does user own the comment??
				if(foundComment.author.id.equals(req.user._id) || req.user.isAdmin){
					next();
				} else {
					req.flash("error", "You don't have permission to do that!");
					res.redirect("back");
				}
			}
		});
	} else {
		req.flash("error", "You need to be logged in to do that!!");
		res.redirect("back");
	}
}

middlewareObj.isLoggedIn = function(req, res, next){
	if(req.isAuthenticated()){
		return next();
	}
	req.flash("error", "You need to be logged in to do that!!");
	res.redirect("/login");
}

module.exports = middlewareObj;