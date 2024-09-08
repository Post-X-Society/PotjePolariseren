const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Room = sequelize.define('Room', {
    uniqueIdentifier: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true
    },
    pinCode: {
      type: DataTypes.STRING(4),
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  });

  Room.associate = function(models) {
    Room.belongsTo(models.User, { as: 'teacher', foreignKey: 'teacherId' });
    Room.belongsToMany(models.User, { 
      through: 'StudentRooms',
      as: 'students',
      foreignKey: 'roomId'
    });
    Room.hasMany(models.Video, { as: 'videos', foreignKey: 'roomId' });
  };

  return Room;
};