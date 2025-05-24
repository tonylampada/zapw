import { createApp } from './app';
import { config } from './utils/config';
import { sessionManager } from './services/sessionManager';
import { whatsappService } from './services/whatsappService';

const app = createApp();

async function startServer() {
  try {
    // Initialize persistence and restore sessions
    console.log('Initializing session manager...');
    await sessionManager.initialize();
    
    console.log('Restoring WhatsApp connections...');
    await whatsappService.initialize();
    
    // Start Express server
    const server = app.listen(config.PORT, () => {
      console.log(`🚀 Server running on port ${config.PORT}`);
      console.log(`📝 Environment: ${config.NODE_ENV}`);
      console.log(`💾 ${sessionManager.getAllSessions().length} sessions restored`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`${signal} received, shutting down gracefully...`);
      
      // Disconnect all WhatsApp sessions
      const sessions = sessionManager.getAllSessions();
      for (const session of sessions) {
        await whatsappService.terminateSession(session.id);
      }
      
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();