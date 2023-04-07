#include<iostream>
using namespace std;
int num( int n);
int main()
{
    int m;
    cout<<"Enter a number =";
    cin>>m;
    cout << num(m);
}
int num( int n)
{
    if (n%2==0)
    {
     cout<<"*** " << n<<" number is Even Number .... ***";
    }else
    {
     cout<<"*** " << n<<" number is ODD Number .... ***";
    }
    return (0);
}
