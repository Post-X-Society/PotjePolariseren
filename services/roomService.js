const { v4: uuidv4 } = require('uuid');

class RoomService {
  constructor(roomModel, userModel) {
    this.Room = roomModel;
    this.User = userModel;
  }

  async getRoomsForTeacher(teacherId) {
    const teacher = await this.User.findByPk(teacherId, {
      include: ['teacherRooms']
    });
    return teacher ? teacher.teacherRooms : [];
  }

  async createRoom(teacherId) {
    const uniqueIdentifier = uuidv4().substr(0, 8);
    const pinCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    return this.Room.create({
      uniqueIdentifier,
      pinCode,
      expiresAt,
      teacherId
    });
  }

  async getRoomByIdentifier(identifier) {
    return this.Room.findOne({
      where: { uniqueIdentifier: identifier },
      include: [{ model: this.User, as: 'teacher', attributes: ['id', 'email'] }]
    });
  }

  async validateRoom(identifier, pinCode) {
    const room = await this.getRoomByIdentifier(identifier);
    if (!room) {
      throw new Error('Potje niet gevonden');
    }
    if (room.pinCode !== pinCode) {
      throw new Error('Onjuiste PIN code');
    }
    if (room.expiresAt < new Date()) {
      throw new Error('Sessie is verlopen');
    }
    return room;
  }
}

module.exports = RoomService;