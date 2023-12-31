
const express = require('express')
const cors = require('cors')
var jwt = require('jsonwebtoken')
require('dotenv').config()
const stripe=require('stripe')(process.env.STRIPE_SECRET_KEY)
const app = express()
const port=process.env.PORT || 3000

// Malware configuration
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ioitfil.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usercollection = client.db("userstDB").collection("users");
    const menucollection = client.db("userstDB").collection("menus");
    const reviewcollection = client.db("userstDB").collection("reviews");
    const cartcollection = client.db("userstDB").collection("carts");
    const paymentcollection = client.db("userstDB").collection("payments");

    app.get('/menus',async(req,res) => {
        const result=await menucollection.find().toArray();
        res.send(result)
    })

    app.get('/reviews',async(req,res) => {
        const result=await reviewcollection.find().toArray();
        res.send(result)
    })
    // ---------------------JWT------------------
    // JWt Related API
    app.post('/jwt',async(req,res)=>{
      const user=req.body;
      const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
        expiresIn:'1h'
      });
      res.send({token})
    })
    // use varify admin after access token
    const verifyadmin=async(req, res,next)=>{
      const email=req.decoded.email;
      const query={email:email}
      const user=await usercollection.findOne(query);
      const isAdmin=user?.role==='admin';
      if (!isAdmin) {
        return res.status(404).send({message:'Forbidden access denied'})
      }
      next();
    }

    // Verified token middleware
    const verifyToken=(req,res,next) =>{
      console.log('Inside token middleware',req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({message: 'Unauthorized access'});
      }
      const token=req.headers.authorization.split(' ')[1];
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
        if (err) {
          return res.status(401).send({message: 'Unauthorized access'});
        }
        req.decoded=decoded;
        next();
      })
      // next();
    }

    app.get('/users/admin/:email',verifyToken,async(req,res)=>{
      const email=req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({message: 'Unauthorized access'});
      }
      const query={email:email}

      const user=await usercollection.findOne(query);
      let admin=false;
      if (user?.role === 'admin') {
        admin=true;
      }
      res.send({admin});
    })


// 68.8

// ----------------------------------------------------------------
    // Users related api
    app.post('/users',async(req,res) => {
        const user=req.body;
        const query = {email:user.email}
        const existingUser=await usercollection.findOne(query);
        if (existingUser) {
          return res.send({ message: 'user already exists', insertedId: null })
        }
        const result=await usercollection.insertOne(user);
        res.send(result)
    })
    // get user to Display
    app.get('/users',verifyToken,verifyadmin, async(req,res)=>{
      console.log(req.headers);
      const result=await usercollection.find().toArray();
      res.send(result);
    })
    // Delete user to Display
    app.delete('/users/:id',verifyToken,verifyadmin, async(req,res)=>{
      const id=req.params.id;
      const query={_id: new ObjectId(id)};
      const result=await usercollection.deleteOne(query);
      res.send(result);
    })
    // Update user admin role
    app.patch('/users/admin/:id',verifyToken,verifyadmin, async(req,res)=>{
      const id=req.params.id;
      const filter={_id: new ObjectId(id)};
      const updateDoc={
        $set:{
          role:'admin'
        }
      }
      const result=await usercollection.updateOne(filter,updateDoc);
      res.send(result);
    })

    // ----------------------------------------------------------------
    // post menu data read


    // ----------------------------------------------------------------
    // post cart data read
    app.get('/carts',async(req,res) => {
        const email=req.query.email;
        const query={email: email}
        const result=await cartcollection.find(query).toArray();
        res.send(result)
    })
    // post cart data
    app.post('/carts',async(req,res) => {
        const cartItem=req.body;
        const result=await cartcollection.insertOne(cartItem);
        res.send(result)
    })
    // delete cart item
    app.delete('/carts/:id',async(req,res) => {
        const id=req.params.id;
        const query={_id: new ObjectId(id)}
        const result=await cartcollection.deleteOne(query);
        res.send(result)
    })
    // ----------------------------------------------------------------
    // post review data read
    app.get('/reviews',async(req,res) => {
        const email=req.query.email;
        const query={email: email}
        const result=await reviewcollection.find(query).toArray();
        res.send(result)
    })
    // post review data
    app.post('/reviews',async(req,res) => {
        const reviewItem=req.body;
        const result=await reviewcollection.insertOne(reviewItem);
        res.send(result)
    })
    // delete review item

    // payment intent
    app.post('/payment-intent',async(req,res) => {
      const {price}=req.body;
      const amount=parseInt(price*100);
      console.log(amount,'amount inside the intent');
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types:['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      });
    })

    app.get('/payments/:email', verifyToken,async(req,res) => {
      const query={email: req.params.email}
      if (req.params.email !== req.decoded.email) {  
        return res.status(403).send({message:'Forbidden access denied'})
      }
      const result=await paymentcollection.find(query).toArray();
      res.send(result)
    })
    app.post('/payments',async(req,res) => {
      const payment=req.body;
      const paymentResult = await paymentcollection.insertOne(payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };
      const deleteResult = await cartcollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send(`Bistroboss server is running at ${port} port`)
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})