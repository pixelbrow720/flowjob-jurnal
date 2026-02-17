// Sample Data Generator for Flowjob Journal
// Run this after the app is installed to populate with demo data

const Database = require('better-sqlite3');
const path = require('path');

class SampleDataGenerator {
  constructor(dbPath) {
    this.db = new Database(dbPath);
  }

  generateSampleModels() {
    const models = [
      {
        name: 'London Open Sweep',
        marketType: 'Forex',
        timeframe: '5m',
        session: 'London',
        entryLogic: 'Wait for liquidity sweep above/below Asian range, enter on retest with confirmation',
        narrative: 'Targets early London volatility by catching institutional liquidity grabs',
        idealCondition: 'Clear Asian range, medium-high volatility, no major news during entry',
        invalidCondition: 'Choppy Asian session, major news release imminent, low liquidity',
        riskModel: 'Fixed R',
        tags: ['ICT', 'Liquidity', 'London', 'Sweep'],
        confluenceChecklist: [
          'Asian range clearly defined',
          'Liquidity resting above/below range',
          'Order block identified for entry',
          'Volume confirmation on sweep'
        ],
        playbookSteps: [
          { title: 'Identify Asian Range', description: 'Mark high and low of Tokyo session (00:00-08:00 GMT)' },
          { title: 'Wait for Liquidity Sweep', description: 'London open should sweep above or below range' },
          { title: 'Identify Order Block', description: 'Find last bearish/bullish candle before sweep' },
          { title: 'Enter on Retest', description: 'Enter when price retests order block' }
        ]
      },
      {
        name: 'NY Reversal',
        marketType: 'Forex',
        timeframe: '15m',
        session: 'New York',
        entryLogic: 'Counter-trend reversal at key levels during NY session open',
        narrative: 'Captures institutional reversal patterns during NY open volatility',
        idealCondition: 'Strong trend prior to NY open, price at key level',
        invalidCondition: 'Ranging market, low volume, no clear levels',
        riskModel: '% Risk',
        tags: ['Reversal', 'New York', 'Key Levels'],
        confluenceChecklist: [
          'Price at major S/R level',
          'Divergence on oscillator',
          'Candlestick reversal pattern',
          'Volume spike'
        ],
        playbookSteps: [
          { title: 'Identify Key Level', description: 'Mark major support/resistance from higher timeframe' },
          { title: 'Wait for NY Open', description: 'Monitor 13:30-14:30 GMT for volatility' },
          { title: 'Confirm Reversal', description: 'Look for rejection candlestick pattern' },
          { title: 'Enter with Tight Stop', description: 'Enter on confirmation with stop beyond structure' }
        ]
      },
      {
        name: 'Crypto Momentum',
        marketType: 'Crypto',
        timeframe: '1H',
        session: 'Any',
        entryLogic: 'Breakout with volume confirmation and retest entry',
        narrative: 'Momentum-based strategy for crypto volatile moves',
        idealCondition: 'Consolidation breaking, increasing volume, clear trend',
        invalidCondition: 'Low volume, multiple false breakouts, no clear structure',
        riskModel: 'ATR Based',
        tags: ['Crypto', 'Breakout', 'Momentum'],
        confluenceChecklist: [
          'Clean consolidation pattern',
          'Volume increasing on breakout',
          'No major resistance nearby',
          'Multiple timeframe alignment'
        ],
        playbookSteps: [
          { title: 'Identify Consolidation', description: 'Mark tight range on hourly chart' },
          { title: 'Wait for Breakout', description: 'Volume must be 2x average' },
          { title: 'Retest Entry', description: 'Enter on pullback to breakout level' },
          { title: 'Trail Stop', description: 'Use ATR trailing stop' }
        ]
      }
    ];

    models.forEach(model => {
      const stmt = this.db.prepare(`
        INSERT INTO models (name, market_type, timeframe, session, entry_logic, 
          narrative, ideal_condition, invalid_condition, risk_model, 
          tags, confluence_checklist, playbook_steps)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        model.name,
        model.marketType,
        model.timeframe,
        model.session,
        model.entryLogic,
        model.narrative,
        model.idealCondition,
        model.invalidCondition,
        model.riskModel,
        JSON.stringify(model.tags),
        JSON.stringify(model.confluenceChecklist),
        JSON.stringify(model.playbookSteps)
      );
    });

    console.log(`✓ Generated ${models.length} sample models`);
  }

  generateSampleTrades() {
    const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD'];
    const directions = ['Long', 'Short'];
    const grades = ['A+', 'A', 'B', 'C', 'F'];
    const emotions = ['Calm', 'Confident', 'Anxious', 'Excited', 'Fearful', 'Greedy'];
    const mistakes = ['FOMO', 'Revenge Trading', 'Moved Stop', 'Overtrading', null, null, null];

    const trades = [];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // 3 months of data

    // Generate 50 sample trades
    for (let i = 0; i < 50; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + Math.floor(Math.random() * 90));
      
      const direction = directions[Math.floor(Math.random() * directions.length)];
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const entryPrice = 1.0500 + Math.random() * 0.1;
      const isWin = Math.random() > 0.4; // 60% win rate
      
      const stopDistance = 0.003;
      const stopLoss = direction === 'Long' 
        ? entryPrice - stopDistance 
        : entryPrice + stopDistance;
      
      const rMultiple = isWin 
        ? 0.5 + Math.random() * 2.5 
        : -(0.3 + Math.random() * 1.2);
      
      const positionSize = 0.5 + Math.random() * 1.5;
      const accountSize = 10000;
      const riskPercent = 1 + Math.random() * 2;
      const riskAmount = accountSize * (riskPercent / 100);
      const netPL = rMultiple * riskAmount;
      
      const takeProfitDistance = stopDistance * (isWin ? 2 + Math.random() * 2 : 0.5);
      const takeProfit = direction === 'Long'
        ? entryPrice + takeProfitDistance
        : entryPrice - takeProfitDistance;

      const setupQuality = isWin ? 7 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 5);
      const disciplineScore = Math.random() > 0.2 ? 7 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 4);
      
      let grade;
      if (setupQuality >= 8 && disciplineScore >= 8) grade = 'A+';
      else if (setupQuality >= 7 && disciplineScore >= 7) grade = 'A';
      else if (setupQuality >= 6 && disciplineScore >= 6) grade = 'B';
      else if (setupQuality >= 4 && disciplineScore >= 4) grade = 'C';
      else grade = 'F';

      const modelId = Math.random() > 0.2 ? (1 + Math.floor(Math.random() * 3)) : null;
      const ruleViolation = disciplineScore < 5 ? 1 : 0;
      const emotionalState = emotions[Math.floor(Math.random() * emotions.length)];
      const mistakeTag = ruleViolation ? mistakes[Math.floor(Math.random() * mistakes.length)] : null;

      const notes = isWin 
        ? ['Perfect execution, followed plan', 'Good entry, patient wait', 'Setup was A+ quality', 'Textbook trade'][Math.floor(Math.random() * 4)]
        : ['Jumped in too early', 'Missed key confluence', 'Market conditions changed', 'Stop was too tight'][Math.floor(Math.random() * 4)];

      trades.push({
        date: date.toISOString().split('T')[0],
        modelId,
        pair,
        direction,
        entryPrice: parseFloat(entryPrice.toFixed(5)),
        stopLoss: parseFloat(stopLoss.toFixed(5)),
        takeProfit: parseFloat(takeProfit.toFixed(5)),
        positionSize: parseFloat(positionSize.toFixed(2)),
        accountSize,
        riskPercent: parseFloat(riskPercent.toFixed(2)),
        rMultiple: parseFloat(rMultiple.toFixed(2)),
        netPL: parseFloat(netPL.toFixed(2)),
        notes,
        emotionalState,
        mistakeTag,
        ruleViolation,
        setupQualityScore: setupQuality,
        disciplineScore,
        tradeGrade: grade
      });
    }

    // Insert trades
    trades.forEach(trade => {
      const stmt = this.db.prepare(`
        INSERT INTO trades (date, model_id, pair, direction, entry_price, stop_loss,
          take_profit, position_size, account_size, risk_percent, r_multiple, net_pl,
          notes, emotional_state, mistake_tag, rule_violation, setup_quality_score, 
          discipline_score, trade_grade)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        trade.date,
        trade.modelId,
        trade.pair,
        trade.direction,
        trade.entryPrice,
        trade.stopLoss,
        trade.takeProfit,
        trade.positionSize,
        trade.accountSize,
        trade.riskPercent,
        trade.rMultiple,
        trade.netPL,
        trade.notes,
        trade.emotionalState,
        trade.mistakeTag,
        trade.ruleViolation,
        trade.setupQualityScore,
        trade.disciplineScore,
        trade.tradeGrade
      );
    });

    console.log(`✓ Generated ${trades.length} sample trades`);
  }

  generate() {
    console.log('🚀 Generating sample data for Flowjob Journal...\n');
    
    this.generateSampleModels();
    this.generateSampleTrades();
    
    console.log('\n✅ Sample data generation complete!');
    console.log('📊 You can now explore the app with demo data');
    
    this.db.close();
  }
}

// Usage
if (require.main === module) {
  const dbPath = process.argv[2] || './flowjob.db';
  const generator = new SampleDataGenerator(dbPath);
  generator.generate();
}

module.exports = SampleDataGenerator;
