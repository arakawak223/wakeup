export const useCollaboration = jest.fn(() => ({
  onlineUsers: [],
  activeVoiceMessages: [],
  sendVoiceMessage: jest.fn(),
  joinRoom: jest.fn(),
  leaveRoom: jest.fn()
}))

export default useCollaboration