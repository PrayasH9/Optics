var mongoose = require("mongoose");

var opticsSchema = new mongoose.Schema({
	name: {
        type: String,
        required: "Image name cannot be blank."
    },
	image: String,
	imageId: String,
	description: String,
	createdAt: { type: Date, default: Date.now },
	author: {
		id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User"
		},
		username: String
	},
	comments: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Comment"
		}
	],
	slug: {
        type: String,
        unique: true
    },
	likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ]
});

// add a slug before the optics gets saved to the database
opticsSchema.pre("save", async function (next) {
	try {
        // check if a new optics is being saved, or if the optics name is being modified
		if (this.isNew || this.isModified("name")) {
			this.slug = await generateUniqueSlug(this._id, this.name);
		}
		next();
	} catch (err) {
		next(err);
	}
});

var Optics = mongoose.model("Optics", opticsSchema);
module.exports = Optics;

async function generateUniqueSlug(id, opticsName, slug) {
    try {
        // generate the initial slug
        if (!slug) {
            slug = slugify(opticsName);
        }
        // check if a optics with the slug already exists
        var optics = await Optics.findOne({slug: slug});
        // check if a optics was found or if the found optics is the current optics
        if (!optics || optics._id.equals(id)) {
            return slug;
        }
        // if not unique, generate a new slug
        var newSlug = slugify(opticsName);
        // check again by calling the function recursively
        return await generateUniqueSlug(id, opticsName, newSlug);
    } catch (err) {
        throw new Error(err);
    }
}

function slugify(text) {
    var slug = text.toString().toLowerCase()
        .replace(/\s+/g, '-')        // Replace spaces with -
        .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
        .replace(/\-\-+/g, '-')      // Replace multiple - with single -
        .replace(/^-+/, '')          // Trim - from start of text
        .replace(/-+$/, '')          // Trim - from end of text
        .substring(0, 75);           // Trim at 75 characters
    return slug + "-" + Math.floor(1000 + Math.random() * 9000);  // Add 4 random digits to improve uniqueness
}