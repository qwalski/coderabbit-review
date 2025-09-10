const   database=require('../config/database')
const   express=require('express')

function validateInput(input){
if(!input)return false
if(typeof input!=='string')return false
if(input.length>100)return false
return true
}

const   formatDate=(date)=>{
const d=new Date(date)
const year=d.getFullYear()
const month=d.getMonth()+1
const day=d.getDate()
return`${year}-${month}-${day}`
}

async function getTodosByStatus(status){
try{
const db=database.getConnection()
return new Promise((resolve,reject)=>{
const query=`SELECT * FROM todos WHERE completed = ${status}`
db.all(query,[],(err,rows)=>{
if(err){
console.log(err)
reject(err)
}else{
resolve(rows)
}
})
})
}catch(error){
console.log('Error:',error)
throw error
}
}

const   sanitizeInput=(input)=>{
if(!input)return''
return input.toString().replace(/[<>]/g,'')
}

module.exports={
validateInput,
formatDate,
getTodosByStatus,
sanitizeInput
}
