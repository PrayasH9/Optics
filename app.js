require('dotenv').config()
var express       = require("express"),
	app           = express(),
	bodyParser    = require("body-parser"),
	mongoose      = require("mongoose"),
	flash         = require("connect-flash"),
	passport      = require("passport"),
	LocalStrategy = require("passport-local"),
	methodOverride = require("method-override"),
	Optics        = require("./models/optics"),
	Comment       = require("./models/comment"),
	User          = require("./models/user");

// requiring routes
var opticsRoutes = require("./routes/optics"),
	commentRoutes    = require("./routes/comments"),
	indexRoutes       = require("./routes/index");

var url = process.env.DATABASEURL || "mongodb://localhost:27017/optics_v1"
mongoose.connect(url, {
	useUnifiedTopology: true,
	useNewUrlParser: true,
	useFindAndModify: false,
	useCreateIndex: true
}).then(() => {
	console.log("connected to DB");
}).catch(err => {
	console.log("ERROR", err.message);
});

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.set("view engine", "ejs");
app.use(flash());
app.locals.moment = require('moment');

// passport config
app.use(require("express-session")({
	secret: "Deathwing The Destroyer!!",
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(async function(req, res, next){
	res.locals.currentUser = req.user;
	if(req.user) {
		try {
			let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
			res.locals.notifications = user.notifications.reverse();
		} catch(err) {
			console.log(err.message);
		}
	}
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next();
});

app.use("/optics", opticsRoutes);
app.use("/optics/:slug/comments", commentRoutes);
app.use("/", indexRoutes);

app.listen(process.env.PORT||3000,process.env.IP, function(){
	console.log("The Optics Server has started!!!");
});