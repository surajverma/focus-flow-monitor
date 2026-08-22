/**
 * Centralized storage layer with write serialization
 * Handles all browser.storage operations with proper queuing
 */

/**
 * Create a storage manager instance
 * @returns {Object} Storage manager with methods
 */
function createStorageManager() {
  let writeQueue = [];
  let isWriting = false;

  /**
   * Queue a write operation
   * @param {Object} data - Data to write
   * @returns {Promise} Resolves when write completes
   */
  async function write(data) {
    return new Promise((resolve, reject) => {
      writeQueue.push({ data, resolve, reject });
      processQueue();
    });
  }

  /**
   * Process the write queue sequentially
   */
  async function processQueue() {
    if (isWriting || writeQueue.length === 0) {
      return;
    }

    isWriting = true;

    try {
      while (writeQueue.length > 0) {
        const { data, resolve, reject } = writeQueue.shift();

        try {
          await browser.storage.local.set(data);
          resolve();
        } catch (err) {
          reject(err);
        }
      }
    } finally {
      isWriting = false;

      // Process any new items that were added while we were writing
      if (writeQueue.length > 0) {
        processQueue();
      }
    }
  }

  /**
   * Read data from storage
   * @param {Array|string} keys - Keys to read
   * @returns {Promise} Resolves with data
   */
  async function read(keys) {
    return browser.storage.local.get(keys);
  }

  /**
   * Remove data from storage
   * @param {Array|string} keys - Keys to remove
   * @returns {Promise} Resolves when removed
   */
  async function remove(keys) {
    return browser.storage.local.remove(keys);
  }

  /**
   * Clear all storage
   * @returns {Promise} Resolves when cleared
   */
  async function clear() {
    return browser.storage.local.clear();
  }

  return {
    write,
    read,
    remove,
    clear,
    getQueueLength: () => writeQueue.length,
    isWriting: () => isWriting,
  };
}

// Exports for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createStorageManager,
  };
}
