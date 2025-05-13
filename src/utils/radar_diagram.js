const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs');

// Define dimensions for the radar chart canvas
const width = 600;
const height = 600;

// Initialize ChartJS canvas with dark theme background
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'rgba(46,46,46,1)' });

/**
 * Mapping of mood categories to their respective individual moods.
 * Each category contains:
 * - label: Display name for the category
 * - moods: Array of specific moods that fall under this category
 * 
 * This structure helps in aggregating individual moods into broader emotional categories
 * for better visualization and analysis.
 */
const AGGREGATED_CATEGORY_MOODS = {
  positive: { label: "Positive", moods: ['happy', 'relaxed', 'excited'] },
  motivated: { label: "Motivated", moods: ['motivated', 'naughty', 'confused'] },
  anxious: { label: "Anxious", moods: ['anxious', 'overthinking', 'nervous'] },
  negative: { label: "Negative", moods: ['disappointed', 'sad', 'overwhelmed'] },
  drained: { label: "Drained", moods: ['tired', 'sick', 'angry'] },
  calm: { label: "Calm", moods: ['neutral', 'uncertain', 'bored'] }
}

/**
 * Aggregates individual mood frequencies into their respective categories.
 * @param {Object} moodData - Object containing mood frequencies where keys are mood names and values are frequencies
 * @returns {Object} Aggregated frequencies for each mood category
 * 
 * @example
 * const moodData = { happy: 2, sad: 1, anxious: 3 };
 * aggregateMoodsFrequency(moodData);
 * // Returns: { positive: 2, motivated: 0, anxious: 3, negative: 1, drained: 0, calm: 0 }
 */
function aggregateMoodsFrequency(moodData) {
  // Initialize aggregated moods object with zero counts
  const aggregatedMoods = {};
  Object.keys(AGGREGATED_CATEGORY_MOODS).forEach(category => {
    aggregatedMoods[category] = 1 // set all categories to 1 better for the radar chart
  });

  // Aggregate individual mood frequencies into their respective categories
  Object.keys(moodData).forEach(mood => {
    const category = Object.keys(AGGREGATED_CATEGORY_MOODS).find(cat => AGGREGATED_CATEGORY_MOODS[cat].moods.includes(mood));
    if (category) {
      aggregatedMoods[category] += moodData[mood];
    }
  });
  return aggregatedMoods;
}

/**
 * Generates the configuration object for the radar chart.
 * @param {number[]} data - Array of values for each category
 * @param {string[]} labels - Array of category labels
 * @returns {Object} Chart.js configuration object
 */
const radarConfig = (data, labels) => ({
  type: 'radar',
  data: {
    labels,
    datasets: [{
      data,
      backgroundColor: 'rgba(54, 162, 235, 0.2)', // Light blue with transparency
      borderColor: 'rgba(54, 162, 235, 1)',       // Solid blue for border
      pointBackgroundColor: 'rgba(54, 162, 235, 1)', // Solid blue for points
    }]
  },
  options: {
    responsive: false,
    scales: {
      r: {
        // Configure radar chart grid lines and labels
        angleLines: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          lineWidth: 1,
        },
        suggestedMin: 0,
        pointLabels: {
          font: { size: 16 },
          color: 'rgba(255, 255, 255, 0.9)', // Nearly white text for dark background
        },
        ticks: {
          display: false // Hide radar chart circular grid labels
        }
      }
    },
    plugins: {
      title: {
        display: false,
      },
      legend: {
        display: false // Hide legend as we only have one dataset
      }
    },
  }
});

/**
 * Generates and saves a radar chart visualization of mood data.
 * @param {Object} moodData - Object containing mood frequencies
 * @param {string} outputPath - File path where the chart image will be saved
 * @returns {Promise<void>} 
 * 
 * @example
 * await generateMoodRadarChart({ happy: 2, sad: 1 }, './mood-chart.png');
 */
async function generateMoodRadarChart(moodData, outputPath) {
  // Aggregate individual moods into categories
  const aggregatedMoods = aggregateMoodsFrequency(moodData);

  // Prepare data for the radar chart
  const data = Object.values(aggregatedMoods);
  const labels = Object.values(AGGREGATED_CATEGORY_MOODS).map(m => m.label);

  // Generate and save the chart
  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(radarConfig(data, labels), 'image/png');
  fs.writeFileSync(outputPath, imageBuffer);
  console.log(`💾 Radar chart saved as ${outputPath}`);
}

module.exports = {
  generateMoodRadarChart,
};
