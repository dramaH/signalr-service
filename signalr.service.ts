import { Injectable } from '@angular/core';
import * as signalR from '@aspnet/signalr';
import { Subject, Observable, interval } from 'rxjs';




@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private $message: Subject<any>;
  private connection: signalR.HubConnection;
  isConnected: boolean;                            // 是否已经连接
  period = 60 * 1000 * 10;                         // 心跳监测频率 1次/10min
  $serverTimeoutSubscription = null;               // 定时检测连接对象
  reconnectFlag = false;                           // 重连状态
  reconnectPeriod = 5 * 1000;                      // 重连失败,则5秒钟重连一次
  $reconnectSubscription = null;                   // 重连订阅对象
  $runTimeSubscription;                            // 运行时间对象
  runTimePeriod = 1000;                            // 记录运行单位（秒）
  runTime = 0;                                      // 当前连接运行时间
  constructor () { }


  public go() {
    this.$message = new Subject<any>();
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`...连接地址...`)
      .build();
    this.connect();
    this.heartCheckStart();
  }

  private connect() {
    this.connection.start().then((e) => {

      this.isConnected = true;
      console.log('连接成功');
      this.calcRunTime();
      this.listenFromTarget();

      // 如果是重连中
      if (this.reconnectFlag) {
        // 1.停止重连
        this.stopReconnect();
        // 2.重新开启心跳
        this.heartCheckStart();
        // 3.重新开始计算运行时间
        this.calcRunTime();
      }


    }).catch((err) => {
      console.log(`连接失败`);

      // this.disconnect();
      this.stopRunTime();
      this.reconnect();

    }).then(() => { });
  }

  /** 
  * @description 销毁连接
  */
  DestoryConnect() {
    this.connection.onclose((res) => {
      console.log('已销毁连接');
      if (res) {
        console.log('销毁连接失败', res);
      }
    });

  }



  /**
   * @description 获取服务端信息
   */
  getMessage(): Observable<any> {
    return this.$message;
  }

  /**
   * @description 调用服务端 SendMessage 方法完成通信
   * @param messageData 向服务端发送的消息
   * @param callback
   */
  sendMessage(messageData, callback): void {
    if (!this.isConnected) {
      if (callback) {
        callback('当前未连接signalrHub');
      }
    }
    this.connection.invoke('SendMessage', messageData).then((result) => {
      if (callback) {
        callback(result);
      }
    }).catch((error) => {
      if (callback) {
        callback(error);
      }
    });
  }

  /**
  * @description 初始化需监听的设备
  */
  initMechineType(prama?, callback?): Promise<any> {
    return this.connection.invoke("SendMessage", prama).catch((err) => console.error(err.toString())).then(() => { });
  }

  /**
  * @description 主动断开连接
  * @return boolean 是否成功断开连接
  */
  disconnect(): boolean {
    let status: boolean;
    this.connection.stop()
      .then(() => {
        this.isConnected = false;
        status = true;
        console.log('已断开连接');
        this.stopRunTime();
      })
      .catch(() => {
        status = false;
        console.log('连接断开失败');
      });
    return status;

  }

  /*
  * 开始心跳监测
  */
  private heartCheckStart() {
    this.$serverTimeoutSubscription = interval(this.period).subscribe((val) => {
      // 保持连接状态,重置下
      if (this.connection != null && this.connection.state === 1) {
        console.log('【第' + (val + 1) + '次心跳监测】', '当前状态：已连接');
      } else {
        // 停止心跳
        this.heartCheckStop();
        // 开始重连
        this.reconnect();
        console.log('连接已断开,即将重新连接...');
      }
    });
  }

  /**
      * 停止心跳检测
      */
  private heartCheckStop() {
    if (!!this.$serverTimeoutSubscription) {
      this.$serverTimeoutSubscription.unsubscribe();
    }
  }

  /**
       * 开始重新连接
       */
  private reconnect() {
    // 如果已重连,则直接return,避免重复连接
    if (this.isConnected) {
      this.stopReconnect();
      console.log('已经连接成功,停止重连');
      return;
    }
    // 如果正在连接中,则直接return,避免产生多个轮训事件
    if (this.reconnectFlag) {
      console.log('重新连接中...');
      return;
    }
    // 开始重连
    this.reconnectFlag = true;
    // 如果没能成功连接,则定时重连
    this.$reconnectSubscription = interval(this.reconnectPeriod).subscribe(async (val) => {

      // 重新连接
      this.connect();
      console.log(`【第 ${val + 1} 次重连】`);
    });
  }

  /**
    * 停止重连
    */
  private stopReconnect() {
    // 连接标识置为false
    this.reconnectFlag = false;
    // 取消订阅
    if (typeof this.$reconnectSubscription !== 'undefined' && this.$reconnectSubscription != null) {
      this.$reconnectSubscription.unsubscribe();
      console.log();
    }
  }

  /**
      * 开始计算运行时间
      */
  private calcRunTime() {
    this.$runTimeSubscription = interval(this.runTimePeriod).subscribe((period) => {
      // console.log('运行时间', `${period}秒钟`);
      this.runTime = period;
    });
  }

  /**
   * 停止计算运行时间
   */
  private stopRunTime() {
    if (!!this.$runTimeSubscription) {
      this.$runTimeSubscription.unsubscribe();
      this.$runTimeSubscription = null;
      if (!this.$runTimeSubscription) console.log('连接时间', this.runTime + '秒');
    }
  }

}
