/**
 * import npm modules
 */
var request = require('request-promise')
var Promise = require('bluebird')
var reload = require('require-reload')(require)
var fs = require('fs')

/**
 * import package modules
 */
var Feed = require('../feed')
var helpers = require('../helpers')
var constants = require('../constants')
var redis = require('../redisSetup')
var redisKeyPersist = require('./redisKeyPersistanceSetup')
var coinPersist = require('./coinInfoPersistanceSetup')

class Lykke { 
	constructor(){
		this.exchange = 'lykke'
		this.filePath = __dirname
		this.redisKeyPersist = redisKeyPersist(constants.STRINGS.bitfinex)
		this.coinPersist = coinPersist(constants.STRINGS.bitfinex)
		this.txMakerFee = 0.0025
		this.txTakerFee = 0.0025
		this.depositFee = 0

		this.notice = 'status_message'
		this.bidPrice = 'bid'
		this.askPrice = 'ask'
		this.lastPrice = 'lastPrice'
		this.btcVolume = 'volume24H'
		this.tickerApi = 'https://public-api.lykke.com/api/Market'
		
		this.tickerApi = 'https://api.gdax.com/products/||/ticker'
		
		this.marketCoinApi2Field = 'id'
		this.coinWithdrawActiveField = 'status'
		this.coinDepositActiveField = 'status'
		this.api3ResultSubKey = ''
        this.coinsApi = 'https://api.gdax.com/currencies'
        
        this.buyKey = 'bids'
		this.sellKey = 'asks'
		this.quantityKey = '1'
		this.rateKey = '0'
		this.parameterField = 'id'
		this.orderBookApi = 'https://api.gdax.com/products/||/book?limit=20'
		
		//not available
		this.market = 'display_name'
		this.marketCoin = 'base_currency'
		this.marketCoinLong = 'base_currency'
		this.baseCoin = 'quote_currency'
		this.baseCoinLong = 'quote_currency'
		this.marketIsActive = 'status'
		this.tickerApiResultSubKey = ''		
		this.marketsApiResultSubKey = ''
		this.withdrawFeeField = 'TxFee'
	}

	getMarkets(){
		return reload('markets.json')
	}

	async refreshFeeds(){
		console.log(`Refreshing ${this.exchange}'s markets.`)
		console.time(`${this.exchange}'s Markets`)
		//fetch all the markets
		var getTicker = {
			uri: this.tickerApi,
			json: true,
			headers: {
				'User-Agent': 'ihaaaBackend'
			}
		}
		try {
			var tickers = await request.get(getTicker)
		} catch(err) {
			return helpers.handleError(err, 'fetching markets', `${this.exchange}`)
		}
		//then for each market fetch the ticket 
		if(tickers){
			tickers.forEach(async (ticker)=>{
				//timestamp 
				var timestamp = helpers.getTimestamp()
				//get formatted market name
				var marketName = helpers.getMarketName(market[this.marketCoin], market[this.baseCoin])
				//get redis key
				var redisKey = helpers.getRedisKeyForMarketFeed(this.exchange, marketName)
				//market coin long
				var marketCoinLong = helpers.getMarketCurrencyLong(market[this.marketCoinLong])
				//base coin long
				var baseCoinLong = helpers.getBaseCurrencyLong(market[this.baseCoin])
				//base coin 
				var baseCoin = helpers.getBaseCurrency(market[this.baseCoin])
				//market coin
				var marketCoin = helpers.getMarketCurrency(market[this.marketCoin])
				//market is active
				var marketIsActive = helpers.getMarketIsActive(market[this.marketIsActive])
				//askPrice
				var askPrice = helpers.getFormattedPrice(ticker[this.askPrice])
				//bidPrice
				var bidPrice = helpers.getFormattedPrice(ticker[this.bidPrice])
				//lastPrice
				var lastPrice = helpers.getFormattedPrice(ticker[this.lastPrice])

				if(redisKey){
					//if this shitCoin has a market with it being base coin in this exchange then save the last price of its btc market
					//this is required for calculation of btc volume
					var temp = marketName.split('/')
					var marketCoin = temp[0]
					var baseCoin = temp[1]
					if(!global[this.exchange+'BaseCoins']){
						global[this.exchange+'BaseCoins'] = []	
					} else {
						if(global[this.exchange+'BaseCoins'].indexOf(marketCoin) != -1 && baseCoin == constants.STRINGS.bitcoinShortNotation){ //needs dictionary
							global[this.exchange+'-'+marketCoin] = lastPrice
						}
					}
				}

				if(redisKey){
					var btcVolume
					//needs dictionary
					if(baseCoin == constants.STRINGS.bitcoinShortNotation) {
						btcVolume = helpers.getFormattedVolume(market[this.btcVolume])
					} else {
						btcVolume = helpers.getBtcVolume(market[this.btcVolume], baseCoin, this.exchange)
					}
					var dollarVolume = helpers.getDollarVolume(btcVolume)
				}

				
				if(redisKey){
					redis.hmset(redisKey, 
						'exchange', this.exchange,
						'marketCoin', marketCoin, 
						'baseCoin', baseCoin, 
						'marketCoinLong', marketCoinLong, 
						'baseCoinLong', baseCoinLong,
						'market', marketName,
						'marketIsActive', helpers.getMarketIsActive(market[this.marketIsActive]),
						'buyKey', this.buyKey,
						'sellKey', this.sellKey,
						'quantityKey', this.quantityKey,
						'rateKey', this.rateKey,
						'parameterField', this.parameterField,
						'orderBookApi', this.orderBookApi.replace(/\|\|/g, market[this.parameterField]),
						'dollarVolume', dollarVolume, 
						'lastPrice', lastPrice, 
						'btcVolume', btcVolume, 
						'bidPrice', bidPrice,
						'askPrice', askPrice,
						'timestamp', timestamp
					)
				}
			})
		}
		//save them to redis
		console.timeEnd(`${this.exchange}'s Markets`)
		console.log(`${this.exchange}'s markets refreshed.`)
	}

	async refreshCoins(){
		super.refreshCoins.call(this);
	}
}

module.exports = Lykke