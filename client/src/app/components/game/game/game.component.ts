import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Subscription, concatMap, tap, take, delay } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { GameService } from 'src/app/services/game.service';
import { HttpService } from 'src/app/services/http.service';
import { QuizService } from 'src/app/services/quiz.service';
import { SocketService } from 'src/app/services/socket.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css'],
  // changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameComponent implements OnInit, OnDestroy {
  isLoaded: boolean = false;
  list_of_users_joined = [];
  roomId
  subs: Subscription[] = [];
  subscriptionGetSocketRoom: Subscription;
  subscriptionDeleteRoom: Subscription

  subscriptionHttpQID: Subscription
  subscriptionHttpR: Subscription

  username;
  nickname;

  isHost: boolean = false;

  @Input() sendNickname: string;

  subscriptionGetQuizId: Subscription
  subscriptionHost: Subscription
  subscriptionElse: Subscription
  subscriptionStartGame: Subscription
  subscriptionSocketStartGame: Subscription
  quizId;
  quizInfo;
  listOfQuestions;

  bob: boolean = false;


  list_of_users = [];
  playGame;
  loaded: boolean = false;
  roomInfo
  socketId
  isGameStart
  quizQuestions;
  currentQuestion;
  questionCounter = 0;
  length;
  selectedAnswer: string;
  points: number = 0;

  answerSelected: Subscription;

  constructor(private httpService: HttpService, private socketService: SocketService, private authService: AuthService, private gameService: GameService, private quizService: QuizService) {

  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async quizLoop(length, quizQuestions) {


    for (let i = 0; i < length;) {
      await this.httpService.get("getSongById", quizQuestions[i]['songId']).subscribe((res) => {
        // Creates memory leak rn... fix later
        console.log('done')
        console.log(res)
      });


      console.log(quizQuestions)
      console.log(`Waiting ${i} seconds...`);
      this.currentQuestion = this.quizQuestions[i];
      i++;
      console.log(this.currentQuestion.correctAnswer.correctAnswer)
      console.log(this.selectedAnswer)
      await this.sleep(i * 6000);
      if (this.currentQuestion.correctAnswer.correctAnswer == this.selectedAnswer) {
        console.log('in here')
        this.points += 10;
      }
      this.questionCounter = i
    }
    console.log('Done');
  }

  ngOnInit() {

    // Using params because it's faster than subject subscription. Allows me to segregate the host from another user
    // Host check is kind of unsafe... need to find another way to fix this. Currently it checks if a quizId isn't provided & if user is logged in, and if LS username = to quizId owner. IF JWT token validation is changed upon editing username.. this is safe. Otherwise, not.

    // This may be to slow to work
    this.subscriptionGetQuizId = this.quizService.selectedQuizInfo.subscribe((quizId) => {
      this.quizId = quizId;
      console.log(this.quizId);
    })

    // Handle Game after Host presses start button
    this.subscriptionStartGame = this.socketService.startGame().pipe(delay(1000),take(1)).subscribe((res) => {
      this.isLoaded = false;
      this.isGameStart = true
      // this.quizQuestions = res;
      console.log(this.quizQuestions)
      console.log(this.quizQuestions[0])
      this.length = this.quizQuestions.length;
      console.log("starting game now :)")

      // Handle first initial display
      console.log(this.questionCounter)
      console.log(this.length);

      this.quizLoop(this.length, this.quizQuestions)
    })

    // NOTE - DOESN'T WORK THE FIRST TIME FOR SOME REASON... MUST BE RAN TWICE.
    // ALSO NEEDS USER CHECKING IN CASE USER BREAKS THINGS.. LIKE HOST RELOADING PAGE,  ETC...

    // If user is the host
    if (this.quizId) {
      console.log('in hre')
      this.subscriptionHost = this.gameService.processQidAndNickname.pipe( // get nickname
        concatMap(res => this.httpService.get('getQuizById', res['quizId'])), // get quizInfo using quizId (quizId gotten if host)
        tap(quizInfo => { console.log(quizInfo); this.quizInfo = quizInfo; console.log(quizInfo['authorId']); }),
        tap(res => this.socketService.connect()), // connect to socket
        tap(res => this.socketService.emit('createLobby', '')), // emit createLobby event to get ID of host
        concatMap(res => this.socketService.createLobby()), // delivers
        tap(socketId => { this.socketId = socketId; console.log(this.socketId) }),
        concatMap(res => this.httpService.get('quizQuestions', this.quizId)), // get questions for game
        tap(res => this.quizQuestions = res),
        concatMap(res => this.httpService.post('createRoom', { quizId: this.quizId, socketId: this.socketId })) // creates room in db and stores above info
      ).subscribe(response => {
        this.roomId = response.toString();
        this.socketId = this.socketId.toString();
        // PUSH roomID TO SUBJECT
        this.gameService.handleRoomIdValue(this.roomId, this.socketId, this.quizQuestions);
        console.log('finished concatmap')
      });

      // Get RoomId from Subject and update DOM
      this.subscriptionGetSocketRoom = this.gameService.processRoomIdValue.subscribe((res) => {
        this.isLoaded = true;
        console.log('output content')
        this.isHost = true;
        console.log(res);
        console.log(res['roomId'])
        console.log(res['socketId'])
        this.roomId = res['roomId'];
        this.socketId = res['socketId'];
        this.quizQuestions = res['quizQuestions']
      })
    }

    // If user isn't a host
    if (!this.quizId) {
      console.log('not a host')
      this.subscriptionElse = this.gameService.processPin.pipe( // get pin
        tap(res => {
          this.roomInfo = res['pin']; this.nickname = res['nickname'];
        }),
        concatMap(res => this.httpService.get('getQuizById', this.roomInfo.quizId)), // get quizInfo using quizId from roomInfo
        tap(quizInfo => { console.log(quizInfo); this.quizInfo = quizInfo; console.log(quizInfo['authorId']); }),
        concatMap(res => this.httpService.get('quizQuestions', this.quizInfo['_id'])), // get questions for game,
        tap(res => { this.quizQuestions = res; console.log(res); console.log(this.quizInfo['_id']) }),
        tap(res => this.socketService.connect()), // connect to socket
        tap(res => this.socketService.emit('joinLobby', { socketId: this.roomInfo.socketId, nickname: this.nickname })), // emit createLobby event to get ID of host
        tap(res => this.socketService.emit('getRoomInfo', this.roomInfo.socketId))
      ).subscribe(response => {
        this.roomId = this.roomInfo._id;
        this.isLoaded = true;
        console.log('end')
        this.gameService.handleRoomIdValue(this.roomId, this.socketId, this.quizQuestions);
      });

    }



  }


  startGameBtn() {
    // Check for amount of players. Should be at least 1 before starting
    console.log("startGameBtn clicked")
    console.log(this.socketId);
    this.socketService.emit("startGame", { socketId: this.socketId, quizQuestions: this.quizQuestions });
  }

  getSelectedAnswer(selectedAnswer: string) {
    console.log(selectedAnswer);
    this.selectedAnswer = selectedAnswer;
  }

  ngOnDestroy() {
    console.log(this.roomId);
    this.socketService.disconnect();
    console.log('in destroy')
    this.subscriptionStartGame.unsubscribe();

    if (!this.isHost) {
      this.subscriptionGetQuizId.unsubscribe()
      this.subscriptionElse.unsubscribe();
    }


    if (this.isHost) {
      // If user is host and has left the room - delete the room from db
      console.log('deleting room')
      this.subscriptionGetQuizId.unsubscribe();
      this.subscriptionHost.unsubscribe();
      this.subscriptionGetSocketRoom.unsubscribe();
      this.httpService.delete('deleteRoom', this.roomId).subscribe(() => {
      })
    }

  }

}
