const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: false,
      validate: {
        isEmail: true
      }
    },
    role: {
      type: DataTypes.ENUM('teacher', 'student'),
      allowNull: false
    }
  });

  User.associate = function(models) {
    User.hasMany(models.Room, { as: 'teacherRooms', foreignKey: 'teacherId' });
    User.belongsToMany(models.Room, { 
      through: 'StudentRooms',
      as: 'studentRooms',
      foreignKey: 'studentId'
    });
    User.hasMany(models.Video, { as: 'videos', foreignKey: 'studentId' });
  };

  return User;
};