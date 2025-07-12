const User = require('../models/User');
const ConsentRequest = require('../models/ConsentRequest');

// Store connected users
const connectedUsers = new Map();

const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Handle user authentication
    socket.on('authenticate', async (data) => {
      try {
        const { address } = data;
        
        if (!address) {
          socket.emit('error', { message: 'Address is required' });
          return;
        }

        // Store user connection
        connectedUsers.set(address.toLowerCase(), socket.id);
        socket.userAddress = address.toLowerCase();

        // Update user's last seen
        await User.findOneAndUpdate(
          { address: address.toLowerCase() },
          { lastSeen: new Date() },
          { upsert: true }
        );

        socket.emit('authenticated', { 
          message: 'Successfully authenticated',
          address: address.toLowerCase()
        });

        console.log(`✅ User authenticated: ${address}`);

      } catch (error) {
        console.error('Socket authentication error:', error);
        socket.emit('error', { message: 'Authentication failed' });
      }
    });

    // Handle consent request notifications
    socket.on('consent_request', async (data) => {
      try {
        const { requester, dataType, requestId } = data;
        
        // Emit to data owner
        socket.broadcast.emit('consent_request', {
          requester,
          dataType,
          requestId,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error handling consent request:', error);
      }
    });

    // Handle access granted notifications
    socket.on('access_granted', async (data) => {
      try {
        const { dataOwner, dataType, requestId } = data;
        
        // Emit to requester
        socket.broadcast.emit('access_granted', {
          dataOwner,
          dataType,
          requestId,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error handling access granted:', error);
      }
    });

    // Handle access revoked notifications
    socket.on('access_revoked', async (data) => {
      try {
        const { dataOwner, dataType, requestId } = data;
        
        // Emit to requester
        socket.broadcast.emit('access_revoked', {
          dataOwner,
          dataType,
          requestId,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error handling access revoked:', error);
      }
    });

    // Handle token reward notifications
    socket.on('token_reward', async (data) => {
      try {
        const { amount, reason, userAddress } = data;
        
        // Emit to specific user
        const userSocketId = connectedUsers.get(userAddress.toLowerCase());
        if (userSocketId) {
          io.to(userSocketId).emit('token_reward', {
            amount,
            reason,
            timestamp: new Date()
          });
        }

      } catch (error) {
        console.error('Error handling token reward:', error);
      }
    });

    // Handle ZK proof verification
    socket.on('zk_proof_verification', async (data) => {
      try {
        const { proofHash, circuitType, userAddress } = data;
        
        // Simulate ZK proof verification
        const isValid = Math.random() > 0.1; // 90% success rate
        const verificationTime = Math.random() * 0.1; // 0-100ms
        
        const result = {
          proofHash,
          circuitType,
          isValid,
          verificationTime,
          timestamp: new Date()
        };

        // Emit result to user
        const userSocketId = connectedUsers.get(userAddress.toLowerCase());
        if (userSocketId) {
          io.to(userSocketId).emit('zk_proof_result', result);
        }

      } catch (error) {
        console.error('Error handling ZK proof verification:', error);
      }
    });

    // Handle real-time data access logging
    socket.on('data_access_log', async (data) => {
      try {
        const { requester, dataType, accessType, transactionHash } = data;
        
        // Broadcast to all connected users
        io.emit('data_access_log', {
          requester,
          dataType,
          accessType,
          transactionHash,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error handling data access log:', error);
      }
    });

    // Handle user status updates
    socket.on('user_status_update', async (data) => {
      try {
        const { address, status } = data;
        
        // Update user status in database
        await User.findOneAndUpdate(
          { address: address.toLowerCase() },
          { 
            lastSeen: new Date(),
            isActive: status === 'online'
          }
        );

        // Broadcast user status to all connected users
        io.emit('user_status_update', {
          address,
          status,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error handling user status update:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${socket.id}`);
      
      if (socket.userAddress) {
        // Remove from connected users
        connectedUsers.delete(socket.userAddress);
        
        // Update user status
        try {
          await User.findOneAndUpdate(
            { address: socket.userAddress },
            { 
              lastSeen: new Date(),
              isActive: false
            }
          );
        } catch (error) {
          console.error('Error updating user status on disconnect:', error);
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Periodic cleanup of expired consent requests
  setInterval(async () => {
    try {
      const expiredRequests = await ConsentRequest.findExpiredRequests();
      
      for (const request of expiredRequests) {
        request.status = 'expired';
        await request.save();
        
        // Notify requester about expired request
        const userSocketId = connectedUsers.get(request.requester.address);
        if (userSocketId) {
          io.to(userSocketId).emit('consent_request_expired', {
            requestId: request._id,
            dataType: request.dataType,
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired requests:', error);
    }
  }, 60000); // Run every minute
};

// Helper function to emit to specific user
const emitToUser = (userAddress, event, data) => {
  const socketId = connectedUsers.get(userAddress.toLowerCase());
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

module.exports = { setupSocketHandlers, emitToUser }; 