export class CollaborationManager {
  onUsersChange = jest.fn()
  onMessageReceive = jest.fn()
  sendMessage = jest.fn()
  joinRoom = jest.fn()
  leaveRoom = jest.fn()

  constructor() {}
}

export default CollaborationManager