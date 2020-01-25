var mysql = require('mysql');
var pool  = null;

exports.connect = function() {
  pool = mysql.createPool({
    host     : 'exotalent.cikprutyvlm9.us-east-1.rds.amazonaws.com',
    user     : 'sa',
    password : 'ab_TAK56',
    database : 'employee'
  });
}

exports.get = function() {
  return pool;
}
