const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000:/");
    });
  } catch (e) {
    console.log(`DB error : ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

// API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `
    SELECT 
     *
    FROM
        user
    WHERE 
        username = "${username}";`;
  const dbUser = await db.get(userQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
    //console.log(1);
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
      //console.log(2);
    }
  }
});

// Authentication API
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertDbObjToResponseObj = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDbObjToResponseObj2 = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

// API 2
app.get("/states/", authentication, async (request, response) => {
  const stateQuery = `
    SELECT 
        *
    FROM 
        state`;
  const dbQuery = await db.all(stateQuery);
  response.send(
    dbQuery.map((eachState) => convertDbObjToResponseObj(eachState))
  );
});

//API 3
app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `
    SELECT 
        *
    FROM 
        state
    WHERE 
        state_id = ${stateId};`;
  const dbQuery = await db.get(stateQuery);
  response.send(convertDbObjToResponseObj(dbQuery));
});

//API 4
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const insertDistrict = `
    INSERT INTO 
        district (district_name, state_id, cases, cured, active, deaths)
    VALUES
        ("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})`;
  await db.run(insertDistrict);
  response.send("District Successfully Added");
});

// API 5
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `
    SELECT 
        *
    FROM
        district
    WHERE 
        district_id = ${districtId};`;
    const dbQuery = await db.get(districtQuery);
    response.send(convertDbObjToResponseObj2(dbQuery));
  }
);

// API 6
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const dbQuery = `
    DELETE FROM 
        district
    WHERE 
        district_id = ${districtId};`;
    await db.run(dbQuery);
    response.send("District Removed");
  }
);

// API 7
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const dbQuery = `
    UPDATE 
        district 
    SET 
        district_name = "${districtName}",
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE 
        district_id = ${districtId};
        `;
    await db.run(dbQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const dbQuery = `
    SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM
        district
    WHERE 
        state_id = ${stateId};`;
    const dbResponse = await db.get(dbQuery);
    response.send(dbResponse);
  }
);

module.exports = app;
