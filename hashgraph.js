'use strict';

require("dotenv").config();

const fs = require("fs");
const util = require('util');

const execFile = util.promisify(require('child_process').execFile);
const exec = util.promisify(require('child_process').exec);

const DAGInterface = require('../DAG-Interface.js');
const myUtil = require('../../util/util.js');
const { Client, CryptoTransferTransaction, Hbar } = require('@hashgraph/sdk');
const { AccountBalanceQuery, AccountRecordsQuery, Ed25519PrivateKey, AccountCreateTransaction } = require('@hashgraph/sdk');

class Hashgraph extends DAGInterface {

   constructor(config_path) {
      super(config_path);
      const config = require(this.configPath);
      this.config = config;
      this.dagType = 'hashgraph';
   }

   async init(env) {
      if (env === 'local') {
         const filePath = './network/hashgraph/start-network.sh';
        
         const num = Number(this.config.node_url.length);

         await execFile(filePath, [`-n ${num}`]);

         myUtil.log('### Hashgraph network start success ###');
         await myUtil.sleep(4000);

         return;
      } else {
         const filePath_aws = './network/hashgraph/aws/hashgraph-aws-node.sh';
        
         const num_aws = Number(this.config.node_url.length);

         await execFile(filePath, [`-n ${num}`]);

         myUtil.log('### Hashgraph aws network start success ###');
         await myUtil.sleep(4000);

         return;
      }

   }
   
   async send(node, sender, send_times, receiver) {
      
      try {

      const client = Client.forTestnet();
      client.setOperator(sender.accountid, sender.key);

      await new CryptoTransferTransaction()
         .addSender(sender.accountid, 1)
         .addRecipient(receiver.accountid, 1)
         .execute(client);

      } catch (error) {
         myUtil.error(`Hashgraph send error: ${error}`);
      }
   }

   async sendAsync(node, sender, order, receiver) {
      const send = sender[order % sender.length];

      try {
         const client = Client.forTestnet();
         client.setOperator(send.accountid, send.key);
   
         await new CryptoTransferTransaction()
            .addSender(send.accountid, 1)
            .addRecipient(receiver.accountid, 1)
            .execute(client);
   
         } catch (error) {
            myUtil.error(`Hashgraph sendAsync error: ${error}`);
         }
   }

   async sendAndWait(node, sender, send_times, receiver) {
      
      // Get the sender‘s information and set up the client
      const send = sender[send_times];
      const client = Client.forTestnet();
      client.setOperator(send.accountid, send.key);
     
      try {

         // Get the timestamp before transferring coin
         const sendTimestamp = new Date().getTime();

         // Call the CryptoTransferTransaction method to implement transfers 
         // and obtain transaction records
         const record = await (await new CryptoTransferTransaction()
            .addSender(send.accountid, 1)
            .addRecipient(receiver.accountid, 1)
            .execute(client))
            .getRecord(client);

         // Calculate the latency of transaction and accurate to second
         const lag = record.consensusTimestamp.asDate().getTime() - sendTimestamp;
         return lag / 1000 % 60;
         
      } catch (error) {
         myUtil.error(`Hashgraph sendAndWait error: ${error}`);
         return null;
      }

   }

   // query workload for Q1
   async getBalance(query_url, account) {
      try {

         // Set up the client using account's information
         const client = Client.forTestnet();
         client.setOperator(account.accountid, account.key);

         // Call the AccountBalanceQuery method to query the balance of given account
         const balance = await new AccountBalanceQuery()
            .setAccountId(account.accountid)
            .execute(client);

         myUtil.log(balance);
         return balance.asTinybar();

      } catch (error) {
         myUtil.error(`Hashgraph getBalance error: ${error}`);
         return null;
      }
   }

   // query workload for Q2
   async getHistory(query_url, senders, receiver) {
      try {

         // Set up the client using account's information
         const client = Client.forTestnet();
         client.setOperator(receiver.accountid, receiver.key);

         // Call the AccountRecordsQuery method to query the transactions record of given account
         const record = await new AccountRecordsQuery()
            .setAccountId(receiver.accountid)
            .execute(client);

         myUtil.log(record);
         return;
      } catch (error) {
         myUtil.error(`Hashgraph getHistory error: ${error}`);
         return;
      }
   }

   async getTransaction(query_url, receiver) {
      try {

         const client = Client.forTestnet();
         client.setOperator(receiver.accountid, receiver.key);

         const tx = await new AccountRecordsQuery()
            .setAccountId(receiver.accountid)
            .execute(client);

         return tx.length;
         
      } catch (error) {
         myUtil.error(`Hashgraph getTransaction error: ${error}`);
         return null;
      }
   }

   generateNodes() {
      const nodes = [];
      const node_url = this.config.node_url;
      for (let url of node_url) {
         nodes.push(`http://${url}`);
      }
      return nodes;
   }

   async generateSenders() {
      myUtil.log('### hashgraph generate senders start ###');
      const senders = [];
      
      // Get the client of the test network using my account ID and private key
      const operatorPrivateKey = process.env.OPERATOR_KEY;
      const operatorAccount = process.env.OPERATOR_ID;    
      const client = Client.forTestnet();
      client.setOperator(operatorAccount, operatorPrivateKey);

      // sender_num represents the number of clients (account) used for testing
      // which is defined in the configuration files for workloads
      for (var i =0; i < this.config.sender_num; i++) {
         
         // Create a new account as the sender by calling the AccountCreateTransaction method
         const privateKey = await Ed25519PrivateKey.generate();
         const transactionId = await new AccountCreateTransaction()
            .setKey(privateKey.publicKey)
            .setInitialBalance(new Hbar(100))
            .execute(client);
         
         // Get the account ID, primary key and balance of the sender
         const transactionReceipt = await transactionId.getReceipt(client);
         const newAccountId = transactionReceipt.getAccountId();
         // Store the information of the newly created sender into the array
         senders.push({ accountid: newAccountId, key: privateKey.toString(), balance: 10 });       
      }
      this.senders = senders;
      myUtil.log('### hashgraph generate senders finish ###');
      // Return the array of senders to the workload layer
      return senders;
   }

   async generateSenderGroup(senders) {
      return senders;
   }

   generateOne() {
      return this.senders;
   }

   async generateReceiver() {
      
      const operatorPrivateKey = process.env.OPERATOR_KEY;
      const operatorAccount = process.env.OPERATOR_ID;
      
      const client = Client.forTestnet();
      client.setOperator(operatorAccount, operatorPrivateKey);

      const privateKey = await Ed25519PrivateKey.generate();
      
      const transactionId = await new AccountCreateTransaction()
        .setKey(privateKey.publicKey)
        .setInitialBalance(new Hbar(10))
        .execute(client);

      const transactionReceipt = await transactionId.getReceipt(client);
      const newAccountId = transactionReceipt.getAccountId();

      return { accountid: newAccountId, key: privateKey.toString(), balance: 10 };

   }

   generateQuery() {
      const query_url = `http://${this.config.query_ip}:${this.config.query_port}`;
      const query_times = Number(this.config.query_times);
      return { query_url, query_times };
   }

   async calBalance(data, receiver) {
      return data;
   }

   async calLatency(data) {
      return data;
   }

   async throughtputHeader() {
      const header = [
         { id: 'nodes', title: 'NODE' },
         { id: 'client', title: 'CLIENT' },
         { id: 'rate', title: 'RATE' },
         { id: 'duration', title: 'DURATION' },
         { id: 'tps', title: 'TPS' },
         { id: 'ctps', title: 'CTPS' }
      ]
      return header;
   }

   async throughtputRecords(transactions, balance, times, nodes, senders, duration) {
      const rate = times / duration;
      const confirmed = balance[balance.length - 1] - balance[0];
      const valid_trans = transactions[transactions.length - 1] - transactions[0];
      const valid_duration = 0.9 * duration;
      const tps = (valid_trans / valid_duration).toFixed(4);
      const ctps = (confirmed / valid_duration).toFixed(4);

      const records = [{
         nodes,
         client: senders,
         rate,
         duration: valid_duration,
         tps,
         ctps
      }]
      return records;
   }

   async finalise() {
      await exec('docker stop $(docker ps -a -q)');
      await exec('docker rm $(docker ps -a -q)');

      myUtil.log('### Hashgraph finalise success ###');
      return;
   }
}

module.exports = Hashgraph;