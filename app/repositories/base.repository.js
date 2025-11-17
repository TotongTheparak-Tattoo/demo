class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async add(data, transaction) {
    let newItem
    if (transaction) {
      newItem = new this.model(data, { transaction: transaction });
    } else {
      newItem = new this.model(data);
    }

    return await newItem.save();
  }

  async getAll() {
    return await this.model.findAll();
  }

  async getByPk(id) {
    return await this.model.findByPk(id);
  }

  async update(id, updates) {
    const record = await this.model.findByPk(id);
    return await record.update(updates);
  }
  async delete(id) {
    return await this.model.destroy({
      where: {
        id: id,
      },
    });
  }
}

module.exports = BaseRepository;
