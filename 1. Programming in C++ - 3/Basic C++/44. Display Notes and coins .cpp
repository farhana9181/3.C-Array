#include<iostream>
using namespace std;
int main()
{
    float  N,aux ;
    int temp;
    cin>>N;
    temp=N/100;
    cout<<temp<< " nota(s) de R$ 100.00"<<endl;
    aux=temp%100;
    cout<<aux/50<< " nota(s) de R$ 50.00"<<endl;
    aux=aux%50;
      cout<<aux/20<< " nota(s) de R$ 20.00"<<endl;
    aux=aux%20;
cout<<aux/10<< " nota(s) de R$ 10.00"<<endl;
    aux=aux%10;
 cout<<aux/5<< " nota(s) de R$ 5.00"<<endl;
    aux=aux%5;
cout<<aux/2<< " nota(s) de R$ 2.00"<<endl;


}
