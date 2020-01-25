var express = require("express"),
  _ = require("lodash"),
  config = require("../config"),
  jwt = require("jsonwebtoken"),
  ejwt = require("express-jwt"),
  db = require("../db");

var app = (module.exports = express.Router());

var jwtCheck = ejwt({
  secret: config.secretKey
});

function createToken(user) {
  return jwt.sign(_.omit(user, "password"), config.secretKey, {
    expiresIn: 60 * 60 * 5
  });
}

function getUserDB(username, done) {
  db.get().query(
    "SELECT * FROM employee WHERE name = ? LIMIT 1",
    [username],
    function(err, rows, fields) {
      if (err) throw err;
      //console.log(rows[0]);
      done(rows[0]);
    }
  );
}
function getUserDBForId(empId, done) {
  db.get().query(
    "SELECT * FROM employee WHERE empId = ? LIMIT 1",
    [empId],
    function(err, rows, fields) {
      if (err) throw err;
      //console.log(rows[0]);
      done(rows[0]);
    }
  );
}

function getHierarchy(empId) {
  return new Promise((resolve, reject) => {
    db.get().query(
      `SELECT hierarchyId as parentHierID from employee where empId=?`,
      [empId],
      function(err, result) {
        if (err) {
          console.error(err);
          console.log(err);
          reject(err);
          return;
        }
        db.get().query(
          `SELECT hierarchyId FROM employee WHERE reportingTo=?`,
          [empId],
          function(err, noOfChild) {
            if (err) {
              console.error(err);
              console.log(err);
              reject(err);
              return;
            }
            let hierarchyId = noOfChild.map(id => id.hierarchyId);
            console.log("hierarchyId", hierarchyId);
            let child = [];
            let hierId;
            if (result.length > 0)
              hierId = result[0].parentHierID + "." + (hierarchyId.length + 1);
            console.log("hierId", hierId);
            hierarchyId = hierarchyId.sort();
            console.log("hierarchyId Sorted", hierarchyId);
            // console.log("parent hierarchyId", result[0].parentHierID)
            for (let i = 0; i < hierarchyId.length; i++) {
              console.log(
                "number",
                i + 1,
                Number(
                  hierarchyId[i].substring(
                    hierarchyId[i].lastIndexOf(".") + 1,
                    hierarchyId[i].length
                  )
                ),
                hierarchyId[i].substring(
                  hierarchyId[i].lastIndexOf(".") + 1,
                  hierarchyId[i].length
                ).length
              );

              if (
                i + 1 !=
                Number(
                  hierarchyId[i].substring(
                    hierarchyId[i].lastIndexOf(".") + 1,
                    hierarchyId[i].length
                  )
                )
              ) {
                hierId = result[0].parentHierID + "." + (i + 1);
                break;
              }
            }
            console.log("hierId", hierId);
            resolve(hierId);
          }
        );
      }
    );
  });
}

function hierIdWhoIsNotReportingToAnyOne() {
  return new Promise((resolve, reject) => {
    db.get().query(`SELECT hierarchyId  from employee `, function(err, result) {
      if (err) {
        console.error(err);
        console.log(err);
        reject(err);
        return;
      }
      console.log("result", result.length);
      if (result.length > 0) {
        let arr = result.map(id => id.hierarchyId);
        // console.log("arr", arr)
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] != null) arr[i] = arr[i].split(".")[0];
        }
        arr = Math.max.apply(null, arr);
        resolve(arr + 1);
      } else resolve(1);
    });
  });
}

app.post("/employee/create", function(req, res) {
  try {
    if (!req.body.name) {
      return res.status(400).send("You must send the username ");
    }

    getUserDB(req.body.name, function(user) {
      if (!user) {
        user = {
          name: req.body.name,
          dob: req.body.dob,
          reportingTo: req.body.reportingTo,
          createdOn: new Date()
        };
        if (user.reportingTo !== undefined && (user.reportingTo !== null || user.reportingTo !== "") ) {
          getUserDBForId(user.reportingTo, function(manager) {
            if (!manager) {
              return res
                .status(404)
                .send(
                  "There is no employee present in database,for your reporting manager!!"
                );
            }
            getHierarchy(req.body.reportingTo).then(hierId => {
              console.log("hierId", hierId);

              user.hierarchyId = hierId;
              db.get().query("INSERT INTO employee SET ?", [user], function(
                err,
                result
              ) {
                if (err) throw err;
                newUser = {
                  id: result.insertId,
                  username: user.name,
                  reportingTo: user.reportingTo
                };
                //console.log(newUser);
                 res.status(201).send("Employee Created");
              });
            }).catch(err => {
                console.log(err);
                console.error(err);
                res.status(501).send("Server Error");
                return;
              });
          })
        } else {
          hierIdWhoIsNotReportingToAnyOne()
            .then(hierarchyRes => {
              user.hierarchyId = hierarchyRes;
              console.log("user.hierarchyId", hierarchyRes);

              db.get().query("INSERT INTO employee SET ?", [user], function(
                err,
                result
              ) {
                if (err) throw err;
                newUser = {
                  id: result.insertId,
                  username: user.name,
                  reportingTo: user.reportingTo
                };
                //console.log(newUser);
                res.status(201).send("Employee Created");
              });
            })
            .catch(err => {
              console.log(err);
              console.error(err);
              res.status(501).send("Server Error");
              return;
            });
        }
      } else res.status(400).send("A user with that username already exists");
    });
  } catch (err) {
    console.log(err);
    res.status(500).send(`Server error`);
    return;
  }
});

app.get("/employee/list", function(req, res) {
  try {
    db.get().query(
      "SELECT empId,name,dob,reportingTo,createdOn,modifiedOn FROM employee ",
      function(err, rows, fields) {
        if (err) throw err;
        if (rows.length === 0) {
          return res.status(200).send("No Employees to show!");
        }
        res.json(rows);
      }
    );
  } catch (err) {
    console.log(err);
    res.status(500).send(`Server error`);
    return;
  }
});

function getManager(empId) {
  return new Promise((resolve, reject) => {
    db.get().query(
      `SELECT reportingTo from employee where empId=?`,
      [empId],
      function(err, result) {
        if (err) {
          console.error(err);
          console.log(err);
          reject(err);
          return;
        }
        if (result.length > 0) resolve(result[0].reportingTo);
        else resolve(null);
      }
    );
  });
}

app.delete("/employee/delete/:empId", function(req, res) {
  try {
    getManager(req.params.empId).then(manager => {
      // console.log("user.reportingTo !== manager",user.reportingTo , manager)

      if (manager === null) {
        //   hierIdWhoIsNotReportingToAnyOne()
        //     .then((hierarchyRes) => {
        db.get().query(
          `DELETE FROM  employee where empId=?`,
          [req.params.empId],
          function(err, result) {
            if (err) {
              console.error(err);
              console.log(err);
              return res.status(304).send({
                message: "Error:Data not updates"
              });
            }
            return res.status(202).send("Employee Deleted");
          }
        );
      } else {
        db.get().query(
          `SELECT reportingTo from employee where empId = ?`,
          [req.params.empId],
          function(err, empResult) {
            if (err) {
              console.error(err);
              console.log(err);
              reject(err);
              return;
            } //result 3
            db.get().query(
              `SELECT empId from employee where reportingTo = ?`,
              [req.params.empId],
              function(err, reportigToResult) {
                if (err) {
                  console.error(err);
                  console.log(err);
                  reject(err);
                  return;
                } //5,6
                let empIds = reportigToResult.map(id => id.empId);
                db.get().query(
                  `DELETE FROM  employee where empId=?`,
                  [req.params.empId],
                  function(err, result) {
                    if (err) {
                      console.error(err);
                      console.log(err);
                      return res.status(304).send({
                        message: "Error:Data not updates"
                      });
                    }
                    db.get().query(
                      `UPDATE employee SET reportingTo=? where empId IN (?)`,
                      [empResult[0].reportingTo, empIds],
                      function(err, result) {
                        if (err) {
                          console.error(err);
                          console.log(err);
                          reject(err);
                          return;
                        }
                        return res.status(202).send("Employee Deleted");
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    });
  } catch (err) {
    console.log(err);
    res.status(500).send(`Server error`);
    return;
  }
});
