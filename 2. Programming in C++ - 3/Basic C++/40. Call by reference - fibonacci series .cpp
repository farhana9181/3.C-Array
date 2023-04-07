#include<iostream>
using namespace std;
 void fibonacci(int &f, int &s)
{
    int i,n,temp,sum;
   cout<<" Enter the number of terms =  ";
cin>>n;
    cout << f<<" ";
    cout << s<<" ";
    for(i=3;i<=n;i++){
        sum=f+s;
        cout << sum<<" ";
        temp=f;
        f=s;
        s=sum;
    }
}
int main()
{
    int f,s;
f=0,s=1;
    fibonacci(f,s);
    return 0;
}
