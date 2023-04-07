#include<iostream>
#include<string>
using namespace std;
int main()
{
    char  op;
    float  n,m;
    cout<<"Enter one Operator like ( + , - ,* , /) =  ";
    cin>> op;
    cout<<"Enter Two Numbers = ";
    cin>>n>>m;
    switch(op)
    {
    case '+':
        cout<<n<<" + "<<m << " ="<< n+m;
        break;
    case '-':
        cout<<n<<" - "<<m << " ="<< n-m;
        break;
    case '*':
        cout<<n<<" x "<<m << " ="<< n*m;
        break;
    case '/':
        cout<<n<<" / "<<m << " ="<< n/m;
        break;
    default:
        cout<<"! Error !!  Input Operator is not match. please try again .....";
        break;
    }
    return 0;
}
