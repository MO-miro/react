class H extends React.Component {
  render() {
    return (
      <h1 id="h1" >Hello {this.props.text}!</h1>
    )
  }
}

class T extends React.Component {
  constructor(props) {
     super(props);
     this.state = {
       text: 'world'
     }
  }

  te(a) {
    if (a == 2) {
      Array.from(Array(10), (item, i)=> i).forEach(()=> this.setState({
        text: this.state.text,
      }));
    }
    this.setState({
      text: text.includes('jsonz')? 'world'+a: 'jsonz'+a
    });
  }


  render() {
    const text = this.state.text;
    const style = {color: 'red', fontSize: '12px' };
    return (
        <div onClick={()=> console.log(1)} id="HostComponent">
          <H text={text}/>
          <button key={1} style={style} onClick={()=> this.te(1)} ref={t=> this.button1 = t}>按钮1</button>
          <button key={2} style={style} onClick={()=> this.te(2)} ref={(t)=> {
            this.button2 = t;
            console.log(t);
          }}>按钮2</button>
        </div>
    )
  }
}

T.defaultProps = {
  color: 'blue'
};

const test = ReactDOM.render(
  [<T key={1} />, <T key={2} />],
  document.getElementById('container'),
  ()=> console.log(this),
);
