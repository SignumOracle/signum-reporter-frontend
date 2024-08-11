var App = {
  web3Provider: null,
  contracts: {},
  account: "0x0",
  accounts: [],
  contestAddress: {}, 
  tokenAddress: {},
  web3,
  tokenDecimals: 0,

  init: function () {
    return App.initWeb3();a
  },

  initWeb3: function () {
    if (typeof web3 !== "undefined") {
      console.log("Using web3 detected from external source like Metamask");
      App.web3Provider = window.ethereum;
      web3 = new Web3(window.ethereum);
    } else {
      console.log("Using localhost");
      web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
    }
    return App.initEth();
  },

  initEth: function () {
    ethereum
      .request({ method: "eth_requestAccounts" })
      .then(function (accounts) {
        console.log("Ethereum enabled");
        App.account = accounts[0];
        console.log("In initEth: " + App.account);
        web3.eth.getChainId().then(function (result) {
          App.chainId = result;
          console.log("Chain ID: " + App.chainId);
          return App.initContestContract();
        })
      });
  },

  initContestContract: function () {
    var pathToAbi = "./abis/TheContest.json";
    $.getJSON(pathToAbi, function (abi) {
      App.contracts.Contest = new web3.eth.Contract(abi);
      console.log(App.chainId)
      if (App.chainId === 369) {
        App.contracts.Contest.options.address = "0x09D07923EA339A2aDe40f44BCEE74b2A88a99a54" //pulsechain
      }
      //console.log(App.chainId)
      //console.log("Contract initialized");
      //console.log("Contract address: " +  App.contracts.Contest.options.address);
      //console.log("this is ryan", App.contracts.contestAddress);
      //console.log("this is ryan", App.tokenBalance);
      //console.log("this is staker", App.contracts.Contest.getStakerInfo);
      return App.initTokenContract();
    });
  },

  initTokenContract: function () {
    var pathToAbi = "./abis/ERC20.json";
    $.getJSON(pathToAbi, function (abi) {
      App.contracts.Token = new web3.eth.Contract(abi);
      if (App.chainId === 369) {
        App.contracts.Token.options.address = "0x113c82608A84bD47eE90a7A498b2663f3A7B977C" //pulsechain 
      } 
      //console.log("Token contract initialized");
      //console.log("Token contract address: ", App.contracts.Token.options.address);
      return App.getTokenDecimals();
    });
  },

  
  getTokenDecimals: function () {
    App.contracts.Token.methods
      .decimals()
      .call()
      .then(function (result) {
        App.tokenDecimals = result;
        return App.setPageParams();
      });
  },

  

  setPageParams: function () {
    document.getElementById("contestAddress").innerHTML = App.contracts.Contest.options.address;
    document.getElementById("connectedAddress").innerHTML = App.account;
    App.getTokenBalance();
  },



  getTokenBalance: function () {
    App.contracts.Token.methods
      .balanceOf(App.account)
      .call()
      .then(function (result) {
        let tokenBalance = BigInt(result) / BigInt(10 ** App.tokenDecimals);
        let tokenBalanceString = tokenBalance.toString() + " SRB";
        document.getElementById("tokenBalance").innerHTML = tokenBalanceString;
      });
  },

  getStakedTokenBalance: function () {
    App.contracts.Contest.methods
      .getStakerInfo(App.account)
      .call()
      .then(function (result) {
        let stakedTokenBalance = BigInt(result) / BigInt(10 ** App.tokenDecimals);
        let stakedTokenBalanceString = stakedTokenBalance.toString() + " SRB";
        document.getElementById("stakedTokenBalance").innerHTML = stakedTokenBalanceString;
      });
  },



  /*to18: function(n) {
    return ethers.BigNumber.from(n).mul(ethers.BigNumber.from(10).pow(18));
},*/


   /*uintTob32: function (n) {
    let vars = web3.utils.toHex(n);
    vars = vars.slice(2);
    while (vars.length < 64) {
      vars = "0" + vars;
    }
    vars = "0x" + vars;
    return vars;
  },*/

  uintTob32: function (n) {
    let vars = web3.utils.toBN(n).toString('hex');
    vars = vars.padStart(64, '0');
    return  vars;
  },
  

  reportValue: function () {
    let queryId = document.getElementById("_queryId").value;
    let value = document.getElementById("_value").value;
    let nonce = document.getElementById("_nonce").value;
    let queryData = document.getElementById("_queryData").value;
    let decodedQueryData;

    console.log("Raw queryData:", queryData);

    try {
      // Assuming the structure includes three strings based on your previous message
      decodedQueryData = web3.eth.abi.decodeParameters([
        {type: 'string', name: 'query_type'},
      ], queryData);

      console.log("Decoded Data: ", decodedQueryData);
    } catch (error) {
      console.error("Error decoding queryData. It might not be correctly formatted or the types might be wrong.", error);
      return; // Optionally return if the data is critical and cannot proceed without decoding
    }

    // Now check the decoded data
    if (decodedQueryData.query_type === 'SpotPrice' && value.length !== 66) {
      alert('For SpotPrice, _value must be a 66 characters long string including 0x prefix.');
      return; // Stop execution if validation fails
    }

    // Continue with submission if validation passes
    App.contracts.Contest.methods
      .submitValue(queryId, value, nonce, queryData)
      .send({ from: App.account })
      .then(function (result) {
        console.log("Submission result: ", result);
      }).catch(function (error) {
        console.error("Error in submission: ", error);
      });
  },

  //     value = "0x" + App.uintTob32(web3.utils.toWei(document.getElementById("_value").value, 'ether')).padStart(64, '0');




  stakeToken: function () {
    let stakeAmountInput = document.getElementById("stakeAmount").value;
    if (!stakeAmountInput) {
      console.log("No stake amount entered. Skipping staking process.");
      return; // Exit the function if no input is provided
    }
    let stakeAmount = BigInt(stakeAmountInput) * 1000000000000000000n;
    let tokenContract = App.contracts.Token;
    let contestContractAddress = App.contracts.Contest.options.address;

    // Check current allowance
    tokenContract.methods.allowance(App.account, contestContractAddress).call()
      .then(function (allowance) {
        if (BigInt(allowance) < stakeAmount) {
          // Not enough allowance, need to approve
          return tokenContract.methods.approve(contestContractAddress, stakeAmount.toString()).send({ from: App.account });
        }
        return Promise.resolve();
      })
      .then(function () {
        // Now we can proceed to stake since allowance is set
        return App.contracts.Contest.methods.depositStake(stakeAmount.toString()).send({ from: App.account });
      })
      .then(function (result) {
        console.log("Stake transaction successful:", result);
      })
      .catch(function (error) {
        console.error("Staking failed:", error);
      });
  },
};

$(function () {
  $(window).load(function () {
    document.getElementById("connectButton").disabled = false;
    // App.init();
  });
});
