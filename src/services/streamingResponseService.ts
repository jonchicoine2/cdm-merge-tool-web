export interface StreamingProgress {
  type: 'progress' | 'complete' | 'error';
  processed?: number;
  total?: number;
  data?: unknown;
  error?: string;
}

export class StreamingResponseService {
  private encoder = new TextEncoder();
  private closed = false;

  createStream<T>(
    processor: (
      sendProgress: (progress: StreamingProgress) => void
    ) => Promise<T>
  ): ReadableStream {
    this.closed = false;

    return new ReadableStream({
      start: async (controller) => {
        const sendProgress = (progress: StreamingProgress) => {
          if (!this.closed) {
            try {
              const data = `data: ${JSON.stringify(progress)}\n\n`;
              controller.enqueue(this.encoder.encode(data));
            } catch {
              this.closed = true;
              console.warn('[Streaming] Controller closed, stopping updates');
            }
          }
        };

        try {
          const result = await processor(sendProgress);
          
          if (!this.closed) {
            sendProgress({
              type: 'complete',
              data: result
            });
            controller.close();
          }
        } catch (error) {
          console.error('[Streaming] Processing error:', error);
          
          if (!this.closed) {
            sendProgress({
              type: 'error',
              error: error instanceof Error ? error.message : 'Processing failed'
            });
            controller.close();
          }
        }
      }
    });
  }

  createBatchStream<T, R>(
    items: T[],
    batchSize: number,
    batchDelay: number,
    processor: (item: T) => Promise<R>
  ): ReadableStream {
    return this.createStream(async (sendProgress) => {
      const results: R[] = [];
      let processed = 0;

      sendProgress({
        type: 'progress',
        processed: 0,
        total: items.length
      });

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, Math.min(i + batchSize, items.length));
        
        const batchPromises = batch.map(async (item) => {
          try {
            const result = await processor(item);
            processed++;
            
            sendProgress({
              type: 'progress',
              processed,
              total: items.length
            });
            
            return result;
          } catch (error) {
            console.error('[Streaming] Batch item error:', error);
            processed++;
            
            sendProgress({
              type: 'progress',
              processed,
              total: items.length
            });
            
            throw error;
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          }
        }

        if (i + batchSize < items.length && batchDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }

      return results;
    });
  }
}

export const streamingResponseService = new StreamingResponseService();