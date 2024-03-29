const passport = require('passport');
const { app } = require('../app');
const User = require('../database/models/user.model');
const LocalStrategy = require('passport-local').Strategy;
const { findUserPerEmail, findUserPerGoogleId } = require('../queries/user.queries');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const dotenv = require ('dotenv'); 
dotenv.config ();
const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET

// middleware qui initialise passport
// crée un objet vide sur la requête et y place une instance de passport
// copie également les données de la session si il en existe une dans cet objet
app.use(passport.initialize());
// middleware qui place le user sur l'objet req en utilisant la fonction deserialize
app.use(passport.session());

// permet de definir ce que passport va stocker dans la session pour un utilisateur
passport.serializeUser((user, done) => {
  done(null, user._id);
})

// permet de définir comment passport va récupérer l'utilisateur en utilisant session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).exec();
    done(null, user);  
  } catch(e) {
    done(e, null);
  }
});

// configuration de la stratégie locale d'authentification
// en utilisant un identifiant unique et un mot de passe
passport.use('local', new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await findUserPerEmail(email);
    if (user) {
      const match = await user.comparePassword(password);
      if (match) {
        done(null, user);
      } else {
        done(null, false, { message: `Password doesn't match` })
      }
    } else {
      done(null, false, { message: 'user not found' });
    }
  } catch(e) {
    done(e);
  }
}))

// configuration de la stratégie google OAuth2
passport.use('google', new GoogleStrategy({
  clientID: clientId,
  clientSecret: clientSecret,
  callbackURL: '/auth/google/cb'
}, async (accessToken, refreshToken, profile, done) => {
  // console.log(profile);
  try {
    // récupére l'utilisateur en utilisant GoogleId
    const user = await findUserPerGoogleId(profile.id);
    // si un utilisateur passe à Passeport
    if (user) {
      done(null, user);
      // sinon créer l'utilisateur
    } else {
      const newUser = new User({
        username: profile.displayName,
        local: {
          googleId: profile.id,
          email: profile.emails[0].value
        }
      })
      const savedUser = await newUser.save();
      // retourne l'utilisateur crée à Passport
      done(null, savedUser);
    }
  } catch(e) {
    done(e);
  }
}))