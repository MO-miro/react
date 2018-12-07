const ReactContext = React.createContext({type: 0});
  class App extends React.Component {
  state = {
    type: 1,
  }

  componentDidMount() {
    setInterval(() => {
      this.setState({
        type: this.state.type + 1
      })
    }, 500)
  }

  render() {
    return <ReactContext.Provider value={this.state}><Wrap/></ReactContext.Provider>
  }
}

class Wrap extends React.Component {
  shouldComponentUpdate() {
    return false;
  }

  render() {
    return (
      <div><Comp /></div>
    )
  }
}

 const Comp = () => (
   <ReactContext.Consumer>
     {
       ctx=> (
         <p>{ctx.type}</p>
       )
     }
   </ReactContext.Consumer>
 )

ReactDOM.render(<App />, document.getElementById('container'));




