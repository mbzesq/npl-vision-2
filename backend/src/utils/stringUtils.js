// Levenshtein distance algorithm for string similarity
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  // If either string is empty, return the length of the other
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;
  
  // Initialize the matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill in the matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Calculate similarity score between two strings (0 to 1)
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  if (maxLength === 0) return 1;
  
  return 1 - (distance / maxLength);
}

// Normalize string for comparison
function normalizeString(str) {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ');   // Normalize whitespace
}

// Extract numbers from string
function extractNumbers(str) {
  if (!str) return null;
  
  const matches = str.match(/[\d,]+\.?\d*/);
  if (!matches) return null;
  
  return parseFloat(matches[0].replace(/,/g, ''));
}

module.exports = {
  levenshteinDistance,
  calculateSimilarity,
  normalizeString,
  extractNumbers
};