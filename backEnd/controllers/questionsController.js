const questionSchema = require("../model/questionSchema.js")
const operation = require("../controllers/dbController.js");

const getQuizQuestions = operation.getQuizQuestions(questionSchema);
const createQuestion = operation.createQuestion(questionSchema)
const deleteQuizQuestion = operation.deleteQuizQuestion(questionSchema)
const deleteAllQuizQuestions = operation.deleteAllQuizQuestions(questionSchema)
const getQuestionById = operation.getQuestionById(questionSchema);
const updateQuestionByQuestionId = operation.updateQuestionByQuestionId(questionSchema);

module.exports = {
    getQuizQuestions,
    createQuestion,
    deleteQuizQuestion,
    deleteAllQuizQuestions,
    getQuestionById,
    updateQuestionByQuestionId
}