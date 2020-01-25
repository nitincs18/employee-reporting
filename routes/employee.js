var express = require('express'),
    _       = require('lodash'),
    config  = require('../config'),
    jwt     = require('jsonwebtoken'),
    ejwt    = require('express-jwt'),
    db      = require('../db');

var app = module.exports = express.Router();

var jwtCheck = ejwt({
  secret: config.secretKey
});

function createToken(user) {
  return jwt.sign(_.omit(user, 'password'), config.secretKey, { expiresIn: 60*60*5 });
}

function getUserDB(username, done) {
  db.get().query('SELECT * FROM employee WHERE name = ? LIMIT 1', [username], function(err, rows, fields) {
    if (err) throw err;
    //console.log(rows[0]);
    done(rows[0]);
  });
}

function getHierarchy( empId) {
    return new Promise((resolve, reject) => {
      db.get().query(`SELECT hierarchyId as parentHierID from employee where empId=?`, [empId], function (err, result) {
        if (err) {
          console.error(err);
          console.log(err);
          reject(err);
          return;
        }
        db.get().query(`SELECT hierarchyId FROM employee WHERE reportingTo=?`, [empId], function (err, noOfChild) {
          if (err) {
            console.error(err);
            console.log(err);
            reject(err);
            return;
          }
          let hierarchyId = noOfChild.map(id => id.hierarchyId)
          console.log("hierarchyId", hierarchyId)
          let child = [];
          let hierId;
          if (result.length > 0)
            hierId = result[0].parentHierID + "." + (hierarchyId.length + 1);
          console.log("hierId", hierId)
          hierarchyId = hierarchyId.sort()
          console.log("hierarchyId Sorted",hierarchyId)
          // console.log("parent hierarchyId", result[0].parentHierID)
          for (let i = 0; i < hierarchyId.length; i++) {
            console.log("number",i+1,Number(hierarchyId[i].substring(hierarchyId[i].lastIndexOf('.') + 1, hierarchyId[i].length)),(hierarchyId[i].substring(hierarchyId[i].lastIndexOf('.') + 1, hierarchyId[i].length)).length);
  
            if (i + 1 != Number(hierarchyId[i].substring(hierarchyId[i].lastIndexOf('.') + 1, hierarchyId[i].length))) {
              hierId = result[0].parentHierID + "." + (i + 1);
              break;
            }
          }
          console.log("hierId",hierId)
          resolve(hierId)
        });
      });
    })
  }

  function hierIdWhoIsNotReportingToAnyOne() {
    return new Promise((resolve, reject) => {
      db.get().query(`SELECT hierarchyId  from employee `, function (err, result) {
        if (err) {
          console.error(err);
          console.log(err);
          reject(err);
          return;
        }
        console.log("result",result.length)
        if(result.length > 0){
        let arr = result.map(id => id.hierarchyId);
        // console.log("arr", arr)
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] != null)
            arr[i] = arr[i].split('.')[0]
        }
        arr = Math.max.apply(null, arr)
        resolve(arr + 1)
    }else resolve(1)
      })
    })
  }

app.post('/employee/create', function(req, res) {  
    try{
  if (!req.body.name ) {
    return res.status(400).send("You must send the username ");
  }

  getUserDB(req.body.name, function(user){
    if(!user) {
      user = {
        name: req.body.name,
        dob:req.body.dob,
        reportingTo: req.body.reportingTo,
        createdOn:new Date()
      };
      if(user.reportingTo !== undefined && user.reportingTo !== null){
      getHierarchy(req.body.reportingTo)
        .then((hierId) => {
          console.log("hierId", hierId)
          user.hierarchyId = hierId;
        db.get().query('INSERT INTO employee SET ?', [user], function(err, result){
            if (err) throw err;
            newUser = {
            id: result.insertId,
            username: user.name,
            reportingTo:user.reportingTo
            };
            //console.log(newUser);
            res.status(201).send({
            id_token: createToken(newUser)
            });
        });
    }).catch((err) => {
        console.log(err);
        console.error(err);
        res.status(501).send("Server Error");
        return;
      })
    }else{
        hierIdWhoIsNotReportingToAnyOne()
        .then((hierarchyRes) => {
          user.hierarchyId = hierarchyRes
          console.log("user.hierarchyId", hierarchyRes)
          
        db.get().query('INSERT INTO employee SET ?', [user], function(err, result){
            if (err) throw err;
            newUser = {
            id: result.insertId,
            username: user.name,
            reportingTo:user.reportingTo
            };
            //console.log(newUser);
            res.status(201).send({
            id_token: createToken(newUser)
            });
        });
    }).catch((err) => {
        console.log(err);
        console.error(err);
        res.status(501).send("Server Error");
        return;
      })
    }
    }
    else res.status(400).send("A user with that username already exists");

  });
}catch(err) {
    console.log(err);
    res.status(500).send(`Server error`);
    return;
}
});



app.get('/employee/list', function(req, res) {
  try{
    db.get().query('SELECT * FROM employee ', function(err, rows, fields) {
        if (err) throw err;
        res.json(rows);
      });
  }catch(err){
    console.log(err);
    res.status(500).send(`Server error`);
    return;
  }
  });

  function updateHierId( empId, reportingTo) {
    return new Promise((resolve, reject) => {
    //   console.log("empId,reportingTo", empId, reportingTo)
      db.get().query(`SELECT reportingTo,hierarchyId from employee where empId=?`, [empId], function (err, result) {
        if (err) {
          console.error(err);
          console.log(err);
          reject(err);
          return;
        }
        let hierIdWhoIsDeleted = result[0].hierarchyId;
       
        let hierarchyId = result[0].hierarchyId + "." + "%";
        db.get().query(`SELECT hierarchyId from employee where reportingTo = ?`, [result[0].reportingTo], function (err, reportigToResult) {
            if (err) {
              console.error(err);
              console.log(err);
              reject(err);
              return;
            }
            console.log("reportigToResult",reportigToResult)

        db.get().query(`SELECT empId,reportingTo,hierarchyId from employee where hierarchyId LIKE ?`, [hierarchyId], function (err, hierarchyResult) {
          if (err) {
            console.error(err);
            console.log(err);
            reject(err);
            return;
          }
          console.log("Chlid Id:", hierarchyResult)
  
          let hierIdArray = new Array();
          hierIdArray = hierarchyResult.map(id => id.hierarchyId);
          let empIdArray = new Array();
          empIdArray = hierarchyResult.map(id => id.empId);
          console.log(empIdArray)
  
          db.get().query(`CALL SP_getHierarchyId(?,?)`, [empId, reportingTo], function (err, hierarchyId) {
            if (err) {
              console.error(err);
              console.log(err);
              reject(err);
              return;
            }
            // console.log("Updated hierarchyId:", hierarchyId)
  
            getHierarchy( reportingTo)
             .then((hierId) => {
            //   console.log("hierId", hierId)
              // user.hierarchyId=hierId;
              db.get().query(`UPDATE employee SET reportingTo=?,hierarchyId=? where empId=?`, [reportingTo, hierId, empId], function (err, reportingResult) {
                if (err) {
                  console.error(err);
                  console.log(err);
                  reject(err);
                  return;
                }
                // console.log("reportingResult",reportingResult)
  
                let parentHierarchy = result[0].hierarchyId;
                let newHierarchyId = hierarchyId[0][0].hierID
                let newHierIdOfChildren = new Array();
                for (let i = 0; i < hierIdArray.length; i++) {
                  newHierIdOfChildren[i] = hierIdArray[i].replace(parentHierarchy, newHierarchyId)
                }
                // console.log("newHierIdOfChildren", newHierIdOfChildren)
                if (newHierIdOfChildren.length > 0) {
                  for (let i = 0; i < newHierIdOfChildren.length; i++) {
                    db.get().query(`UPDATE employee SET hierarchyId=? where empId=?`, [newHierIdOfChildren[i], empIdArray[i]], function (err, result) {
                      if (err) {
                        console.error(err);
                        console.log(err);
                        reject(err);
                        return;
                      }
                    //   console.log("newHierIdOfChildren.length == i+1", newHierIdOfChildren.length, i + 1)
                      if (newHierIdOfChildren.length == i + 1)
                        resolve("HierarchyId updated");
                    });
                  }
                }
                else
                  resolve("HierarchyId updated");
              });
            }).catch((err)=>{
              console.error(err);
              console.log(err);
              reject(err);
              return;
            })
          });
        });
      });
    })
    })
  }
  
  function getManager( empId) {
    return new Promise((resolve, reject) => {
      db.get().query(`SELECT reportingTo from employee where empId=?`, [empId], function (err, result) {
        if (err) {
          console.error(err);
          console.log(err);
          reject(err);
          return;
        }
        if (result.length > 0)
          resolve(result[0].reportingTo);
        else resolve(null)
      })
    })
  }


  app.delete('/employee/delete/:empId', function(req, res) {
    try{
        getManager( req.params.empId)
        .then((manager) => {
          // console.log("user.reportingTo !== manager",user.reportingTo , manager)
          
            if (manager === null) {
            //   hierIdWhoIsNotReportingToAnyOne()
            //     .then((hierarchyRes) => {
                  db.get().query(`DELETE FROM  employee where empId=?`, [ req.params.empId], function (err, result) {
                    if (err) {
                      console.error(err);
                      console.log(err);
                      return res.status(304).send({
                        message: 'Error:Data not updates'
                      });
                    }
                    return res.status(202).send('Employee Deleted')
                  });
                // }).catch((err) => {
                //   console.log(err);
                //   console.error(err);
                //   res.status(501).send("Server Error");
                //   return;
                // })
              }
              else{
            // updateHierId(req.params.empId, manager)
            //   .then((hierRes) => {
            //     console.log("hierRes", hierRes)
            db.get().query(`SELECT reportingTo from employee where empId = ?`, [req.params.empId], function (err, empResult) {
                if (err) {
                  console.error(err);
                  console.log(err);
                  reject(err);
                  return;
                }//result 3
                db.get().query(`SELECT empId from employee where reportingTo = ?`, [req.params.empId], function (err, reportigToResult) {
                    if (err) {
                      console.error(err);
                      console.log(err);
                      reject(err);
                      return;
                    }//5,6
                   let empIds = reportigToResult.map(id => id.empId) 
                db.get().query(`DELETE FROM  employee where empId=?`, [ req.params.empId], function (err, result) {
                  if (err) {
                    console.error(err);
                    console.log(err);
                    return res.status(304).send({
                      message: 'Error:Data not updates'
                    });
                  }
                  db.get().query(`UPDATE employee SET reportingTo=? where empId IN (?)`, [empResult[0].reportingTo ,empIds], function (err, result) {
                    if (err) {
                      console.error(err);
                      console.log(err);
                      reject(err);
                      return;
                    }
                  return res.status(202).send('Employee Deleted')
                });
            })
            })
              })
            }
        //   } else {
        //     db.get().query(`DELETE FROM  employee where empId=?`, [ req.params.empId], function (err, result) {
        //       if (err) {
        //         console.error(err);
        //         console.log(err);
        //         return res.status(304).send({
        //           message: 'Error:Data not updates'
        //         });
        //       }              
              
            });
          
        // }).catch((err) => {
        //   console.log(err);
        //   console.error(err);
        //   res.status(501).send("Server Error");
        //   return;
        // })
    }catch(err){
      console.log(err);
      res.status(500).send(`Server error`);
      return;
    }
    });