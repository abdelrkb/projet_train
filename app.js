const express = require('express')
const session = require('express-session');
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const { boolean } = require('webidl-conversions')
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const app = express()
const port = 3000

// Définir EJS en tant que moteur de templating
app.set("view engine", "ejs")
app.use(express.static(path.join(__dirname, 'public')));
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // You can store static files like CSS, JavaScript, etc. in the 'public' directory
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 30 * 60 * 1000 // Session duration: 30 minutes
      }
  }));

// connexion à la base des données 

mongoose.connect('mongodb://localhost:27017/myDb');

const db = mongoose.connection;
// gestion d'exceptions
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// créer une structure equivalante à la table = collection 
const reservationSchema = new mongoose.Schema(
    {
        "trajet": String,
        "retour" : Boolean,
        "dateDepart": String,
        "HeureDepart": String,
        "prixDepart": String,
        "dateArrivee": String,
        "HeureArrivee": String,
        "prixArrivee": String,
        "dateReservation":Date
    }
)
const userSchema = new mongoose.Schema(
    {
        "nom": String,
        "prenom": String,
        "email": String,
        "telephone": String,
        "addresse" : String,
        "mdp" : String,
        "abonnement" : Boolean,
    }
)
const taskSchema = new mongoose.Schema(
    {
        "title": String,
        "volume": Number
    }
)
const trajetSchema = new mongoose.Schema(
    {
        "trajet": String,
        "allerRetour": Boolean,
        "dateDepart": Date,
        "dateArrivee": Date,
        "depart":[],
        "arrivee":[]
        

    }
)

const optionSchema = new mongoose.Schema(
    {
        "nom":String,
        "prix":Number
    }
)
const reservationModel = mongoose.model("reservation", reservationSchema)
const userModel = mongoose.model("user", userSchema)
const taskModel = mongoose.model("task", taskSchema)
const trajetModel = mongoose.model("trajet", trajetSchema)
const optionModel = mongoose.model("option", optionSchema)

// inserer dans la base les option par défaut 
/*
const option1 = new optionModel(
    {
        nom:"option 1",
        prix:35 
    }
)
const option2 = new optionModel(
    {
        nom:"option 2",
        prix:50 
    }
)
const option3 = new optionModel(
    {
        nom:"option 3",
        prix:75 
    }
)

option1.save();
option2.save();
option3.save();
*/
app.use((req,res,next)=>{
    if (!req.session.panier){
        req.session.panier = []
    }
    next();
})
app.get('/', (req,res)=>{
    const reservations =  req.session.panier
    res.render('home',{nombreReservations:reservations.length});
})

app.get('/reservation', async (req,res)=>{

    
    const trajets =  await trajetModel.find();
    const search = false
    res.render('reservation',  {trajets: trajets,search:search});
})

app.post('/reservation/search', async (req,res)=>{
    const {depart,arrivee,trajet, retour, prixdepart, prixretour} = req.body;
    const search = true;

    //res.send(retour)

    const trajets =  await trajetModel.find({
        'dateDepart':depart,
        'dateArrivee':arrivee,
        'trajet':trajet
    });
    
    res.render('reservation',  {trajets: trajets, search: search, depart: depart, arrivee: arrivee, retour: retour, prixdepart: prixdepart, prixretour: prixretour});
})

app.get('/trajet', async (req,res)=>{
    const trajets =  await trajetModel.find({});
    res.render('trajet', {trajets: trajets});
})
app.post('/trajet', async (req,res)=>{
    const {trajet,depart,arrivee} = req.body

    //res.send(depart)
    const user = new trajetModel(
        {
            trajet : trajet,
            dateDepart : depart,
            dateArrivee:arrivee
        }
    )
    try{
        const newUser = await user.save();
        res.redirect("/trajet")
    }
    catch(err){

        console.log(err.message)

    }

    
})

app.post('/options', async (req, res) => {
    const options = await optionModel.find();
    let user = req.session.user || { abonnement: false }; // Default user object if session user is not present
    const { depart, arrivee, trajet, retour, prixdepart, prixretour } = req.body;
    let prixDep = 0;
    let heureDep = null;
    let prixRe = 0;
    let heureRe = null;

    if (prixdepart) {
        const heureprixD = prixdepart.split(' ');
        prixDep = heureprixD[1];
        heureDep = heureprixD[0];
    }
    
    if (prixretour) {
        const heureprixR = prixretour.split(' ');
        prixRe = heureprixR[1];
        heureRe = heureprixR[0];
    }

    res.render('options', { 
        dateDepart: depart, 
        dateArrivee: arrivee, 
        trajet: trajet, 
        prixDepart: prixDep, 
        prixRetour: prixRe, 
        heureDepart: heureDep, 
        heureRetour: heureRe, 
        options: options,
        user : user,
    });
});


app.get('/panier', async (req,res)=>{
    const reservations =  req.session.panier
    console.log(reservations)
    res.render("panier",{ reservations}) 

})
app.post('/panier', async (req, res) => {
    try {
        const options = await optionModel.find();
        const checkBox = req.body.ops;
        const useReduc = req.body.reduc; // Check if the reduction checkbox is checked
        console.log("Received data:", req.body);
        console.log("useReduc value:", useReduc); // Ajoutez ceci pour vérifier la valeur
        const {dateDepart, dateArrivee, trajet, prixDepart, prixRetour, heureDepart, heureRetour} = req.body;
        let total = Number(prixDepart) + Number(prixRetour);
        
        const optionscoch = [];
        if (checkBox != undefined) {
            checkBox.forEach(btn => {
                const btnArray = btn.split(" ");
                const op = {"nom": btnArray[0], "prix": btnArray[1]};
                total += Number(btnArray[1]);
                optionscoch.push(op);
            });
        }
        
        if (useReduc) {
            total -= 10; // Apply the reduction
        }

        const idR = uuidv4();
        req.session.panier.push({
            id: idR,
            dateDepart: dateDepart,
            dateArrivee: dateArrivee,
            trajet: trajet,
            prixDepart: prixDepart,
            prixRetour: prixRetour,
            heureDepart: heureDepart,
            heureRetour: heureRetour,
            optionsCho: optionscoch,
            total: total
        });
        
        res.redirect('/panier');
    } catch (error) {
        console.error("Error adding to panier:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/panier/delete/:id',  (req, res) => {
    const id=req.params.id
    
    
   req.session.panier =  req.session.panier.filter(reservation => reservation.id !=id);
   
  
   //res.send("<a href='/panier'> Votre reservation a ete bien supprimé, vers panier")
   res.redirect('/panier')  
});

app.get('/payement',(req,res)=>{

    const reservations = req.session.panier
    let totalG = 0 ; 
    reservations.forEach(reservation=>{
        totalG += reservation.total
    })

    console.log(reservations)
    console.log(totalG)

   res.render('payer', { reservations,totalG}) 
})  
app.get('/confirmer', (req,res)=>{
    res.render('confirmer');
})

function generateRandomTicketNumber() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let ticketNumber = ''; 
    ticketNumber += letters.charAt(Math.floor(Math.random() * letters.length));
    for (let i = 0; i < 4; i++) {
      ticketNumber += Math.floor(Math.random() * 10); // Ajoute un chiffre aléatoire
    }
    for (let i = 0; i < 3; i++) {
      ticketNumber += letters.charAt(Math.floor(Math.random() * letters.length)); // Ajoute une lettre aléatoire
    }
    return ticketNumber;
  }

app.post('/print',  (req,res)=>{

     const reservations = req.session.panier;
     const name = req.body.cardholderName;
     const ticketNumber = generateRandomTicketNumber();


     reservations.forEach( async reservation=>{
        if (!reservations) {
            throw new Error("Panier non défini dans la session.");
        }
        const res = new reservationModel(
            {
                trajet: reservation.trajet,
                retour : false,
                dateDepart: reservation.dateDepart,
                HeureDepart: reservation.heureDepart,
                prixDepart: reservation.prixDepart,
                dateArrivee: reservation.dateArrivee,
                HeureArrivee: reservation.heureDepart,
                prixArrivee: reservation.prixRetour,
                dateReservation:Date.now(),
                totalPrix : reservation.prixDepart + reservation.prixArrivee
            }
        )
        try{
            const newRes = await res.save();
           
        }
        catch(err){
    
            console.log(err.message)
    
        }

     })
     console.log(reservations);
     res.render('impression', { reservations: reservations, name: name , ticketNumber: ticketNumber});
    })
app.get('/users', async (req, res) => {

    const users =  await userModel.find();
  
    res.render("users",  {users: users})
})

app.get('/users/delete/:id', async (req, res) => {

    const users =  await userModel.deleteOne({_id:req.params.id});
  
    res.redirect('/users')
})

app.get('/users/edit/:id', async (req, res) => {

    const user =  await userModel.findOne({_id:req.params.id});
  
    res.render('edit', {user})
})

app.post('/users/update' , async(req,res)=>{

    try {

        // recuperer les inputs à partir de form 
        const { id, nom, email } = req.body;
        // option pour accepter l'update dans MongoDB
        const options = { upsert: true };
        // affecter les new values
        const updateUser = {
            $set: {
                nom: nom, 
                email: email
            }
        };
        // lancer la requete d'update 
        await userModel.findByIdAndUpdate(id, updateUser, options);
        res.redirect('/users'); // Redirect to the users page after update the user
    } catch (err) {
      res.status(400).json({ message: err.message });
    }

       

})


app.post('/users', async (req, res) => {
    
    const user = new userModel(
        {
            nom : req.body.nom,
            email : req.body.email
        }
    )
    try{
        const newUser = await user.save();
        res.redirect("/users")
    }
    catch(err){

        console.log(err.message)

    }
   



  })


  app.get('/products',(req,res)=>{

    res.render('product/home.ejs')
  })

  app.get('/product/add', (req, res) => {
    const produitName=req.query.produit;
    
    req.session.items = req.session.items || [];
    // Push the new item to the array
    req.session.items.push(produitName);
    res.send('Un nouveau produit ajouté avec succes' + produitName);
  });

  app.get('/product/delete', (req, res) => {
    const produitName=req.query.produit;
  
    req.session.items = req.session.items.filter(produit => produit !=produitName);
    res.redirect('/panier')
  });
  
  app.get('/product/panier', (req, res) => {
    const produits = req.session.items ;
    console.log(produits.leng)
    res.render('product/panier', {produits: produits});
  });
  app.get('/vider_panier', (req, res) => {
    // Clear the session array/
    req.session.panier = [];
    res.redirect('panier')
  });


app.get('/home', (req, res) => {
    console.log('Home route accessed');
    res.render('home');
});

// Route pour afficher le formulaire de connexion
app.get('/account', (req, res) => {
    if (req.session.user) {
        // Si une session de compte est connectée, redirigez vers la page de profil
        res.redirect('/profile');
    } else {
        // Sinon, afficher le formulaire de connexion
        res.render('login'); // Créez une vue pour le formulaire de connexion
    }
});

// Route pour gérer la soumission du formulaire de connexion
app.post('/account/login', async (req, res) => {
    const { email, password } = req.body;
    // Vérifiez si l'utilisateur existe dans la base de données avec cet email et ce mot de passe
    const user = await userModel.findOne({ email: email, mdp: password });
    if (user) {
        req.session.user = user;
        res.redirect('/profile');
    } else {
        // Si les informations de connexion sont incorrectes, redirigez vers la page de connexion avec un message d'erreur
        res.redirect('/account');
    }
});

// Route pour afficher le profil de l'utilisateur
app.get('/profile', (req, res) => {
    if (req.session.user) {
        // Si une session de compte est connectée, afficher les détails de l'utilisateur
        res.render('profile', { user: req.session.user }); // Créez une vue pour afficher le profil de l'utilisateur
    } else {
        // Sinon, redirigez vers la page de connexion
        res.redirect('/account');
    }
});

// Route pour la déconnexion de l'utilisateur
app.get('/logout', (req, res) => {
    // Détruire la session de compte
    req.session.destroy(() => {
        res.redirect('/account');
    });
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})