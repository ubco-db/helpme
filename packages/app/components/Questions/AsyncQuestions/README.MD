# Async questions

## Visibility and deletion
### Students can see questions that are
- their own questions
- visible questions

### Students can delete their own questions only


### Teachers can see questions that are
- all student questions except deleted questions

### Teachers can delete all questions
- deleted questions are no longer displayed actively to any users

## Editing questions
### Students can edit their own questions only

### Teachers can edit all questions

## Asking questions
### Students can ask questions


## Expanded async cards

By default, all questions are collapsed. However, there are a few scenarios where a question card will be expanded:
- clicking on a card will expand the card to show/hide the answer
- after creating a question, the card will be expanded to show the answer
- after editing a question, the card will be expanded to show the answer

Due to the variability of expanded or not, a state in asyncquestions.tsx is maintained to keep track of which cards are expanded or not by storing the question id in an array/variable.