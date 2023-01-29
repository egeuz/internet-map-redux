/* packages & env variables */
import dotenv from 'dotenv';
import axios from 'axios';
import ping from 'ping';
import express from 'express';
import { MongoClient } from 'mongodb';
import { URL } from "node:url";
dotenv.config();

/* init mongodb connection */
const client = new MongoClient(process.env.DB_URI);
let websites;
try {
  await client.connect();
  console.log("Connected to database.");
  websites = client.db("map_nodes").collection("websites");
} catch (err) {
  console.error(err);
}

/* init express server */
const app = express();
app.use(express.json());
var opts = {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html','css','js','ico','jpg','jpeg','png','svg'],
  index: ['index.html'],
  maxAge: '1m',
  redirect: false
}
app.use(express.static('public', opts));
const port = process.env.PORT;
app.listen(port, () => {
  console.log(`mixin it up at port:${port}`)
});

/* express routes */
app.get('/mapbox-token', async (req, res) => {
  res.json({ token: process.env.MAPBOX_TOKEN });
});

app.get('/map-data', async (req, res) => {
  const data = await websites.find().toArray();
  res.json(data);
});

app.post('/website-query', async (req, res) => {
  const { input } = req.body;
  const data = await pingWebsite(input);
  if (data.error_message) {
    res.json(data);
    return;
  }
  const validatedData = await validateDataInDB(data);
  res.json(validatedData);
});

/*** helper methods ***/
async function pingWebsite(input) {
  try {
    // get ip address
    const hostReq = new URL(input).host.replace("www.", "");
    const { host: hostRes, numeric_host: hostIP } = await ping.promise.probe(hostReq);
    // get ip geolocation data
    const geoURL = `https://api.ipgeolocation.io/ipgeo?apiKey=${process.env.IPGEO_APIKEY}&ip=${hostIP}`;
    const geoRes = await axios.get(geoURL);
    const { country_name: country, state_prov: state_province, city, zipcode, latitude, longitude, country_flag, isp, organization } = geoRes.data;
    return {
      host: hostRes,
      locData: {
        ip: hostIP, country, country_flag, state_province, city,
        zipcode, latitude, longitude, isp, organization
      }
    }
  } catch (err) {
    console.error(err);
    return { error_message: "Sorry, an error occurred. :(" }
  }
}

async function validateDataInDB({ host, locData }) {
  const hostInDB = await websites.findOne({ host });
  if (hostInDB) {
    // if host already exists, check its locData array
    let locDataInDB = hostInDB.locations.find(
      l => l.zipcode === locData.zipcode
    );
    if (!locDataInDB) {
      // if the locData is new, update the host data & return it
      const updatedHost = await websites.findOneAndUpdate(
        {host}, 
        { $set: { locations: [locData, ...hostInDB.locations] } }
      );
      return updatedHost.value;
    } else {
      return hostInDB; //if not just return the new doc
    }
  } else {
    // if completely new, add it to the database and return the new entry
    const newHost = { host, locations: [locData] };
    const insertRes = await websites.insertOne(newHost);
    const newHostInDB = await websites.findOne({ host });
    return newHostInDB;
  }
}